import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import "dotenv/config";

// Interface for cache structure
interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

// In-memory caching layer
const jobsCache = new Map<string, CacheEntry<any>>();
const statusesCache = new Map<string, CacheEntry<any>>();
const schedulerCache = new Map<string, CacheEntry<any>>();
const individualJobCache = new Map<number, CacheEntry<any>>();

// Cache TTL settings
const CACHE_TTL_JOBS = 2 * 60 * 1000;         // 2 minutes for jobs list
const CACHE_TTL_STATUSES = 10 * 60 * 1000;    // 10 minutes for job statuses
const CACHE_TTL_SCHEDULER = 1 * 60 * 1000;    // 1 minute for scheduler bookings
const CACHE_TTL_INDIVIDUAL_JOB = 15 * 60 * 1000; // 15 minutes for individual job details (assignedUsers)

// Keep track of the resolved working status url to bypass candidate probes
let cachedWorkingStatusUrl: string | null = null;

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API router to proxy Trak quote requests by quote number or ID
  app.get("/api/quotes/:quoteNo", async (req, res) => {
    try {
      const apiKeyHeader = req.headers["ttrak-key"];
      const apiKey = apiKeyHeader || process.env.TRAK_API_KEY;
      const { quoteNo } = req.params;

      if (!apiKey) {
        console.log(`[Trak Proxy] Quote request for ${quoteNo} without API Key - returning status indication`);
        return res.status(200).json({ 
          isFallback: true, 
          quoteNo, 
          message: "No Trak API Key. Using local placeholder dataset." 
        });
      }

      // Set standard expands so we get contact, client, and item details when ready
      const queryParams = new URLSearchParams();
      queryParams.append("expand", "project,client,mainContact,items,lineItems,notes,job");

      // Check if candidate needs quote_number query parameter search or direct endpoint fetch
      let targetUrl = `https://api.trak.co/quotes/${quoteNo}?${queryParams.toString()}`;
      if (quoteNo.startsWith("QT_") || isNaN(Number(quoteNo))) {
        targetUrl = `https://api.trak.co/quotes?quote_number=${encodeURIComponent(quoteNo)}&${queryParams.toString()}`;
      }

      console.log(`[Trak Proxy] Querying Trak Quote: ${targetUrl}`);
      const response = await fetch(targetUrl, {
        method: "GET",
        headers: {
          "ttrak-key": apiKey as string,
          "Accept": "application/json"
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.warn(`[Trak Proxy] Trak Quote API returned error code ${response.status}. Details: ${errorText}`);
        return res.status(response.status).json({
          error: `Trak API returned error code ${response.status}`,
          details: errorText
        });
      }

      const data = await response.json();
      return res.json(data);
    } catch (error: any) {
      console.error("[Trak Proxy] Exception in quote proxy:", error.message);
      res.status(500).json({
        error: "Internal server proxy error fetching Trak quote",
        details: error.message
      });
    }
  });

  // API router to proxy Trak requests with complete automatic multi-page crawl
  app.get("/api/jobs", async (req, res) => {
    try {
      const apiKeyHeader = req.headers["ttrak-key"];
      // Support taking from local API Key or our default server-side env variable
      const apiKey = apiKeyHeader || process.env.TRAK_API_KEY;

      if (!apiKey) {
        return res.status(401).json({
          error: "API key is missing.",
          details: "Please configure your Trak API Key in the dashboard settings panel."
        });
      }

      // Check cache bypass flag
      const bypassCache = req.headers["x-bypass-cache"] === "true";

      // Re-build query params
      const queryParams = new URLSearchParams();
      Object.entries(req.query).forEach(([key, val]) => {
        if (typeof val === "string") {
          queryParams.append(key, val);
        } else if (Array.isArray(val)) {
          val.forEach((v) => {
            if (typeof v === "string") queryParams.append(key, v);
          });
        }
      });

      // Default expansions for standard fields if not provided
      if (!queryParams.has("expand")) {
        queryParams.append("expand", "project,subJobs,client,mainContact,jobStatus,jobType,contractor,subcontractor,users,notes,job_notes,jobNotes,user_bookings,userBookings,bookings");
      }

      // Default size to 100
      if (!queryParams.has("per-page")) {
        queryParams.append("per-page", "100");
      }

      const cacheKey = `${apiKey}:${queryParams.toString()}`;

      // Try reading from cache first if bypass-cache is false
      if (!bypassCache) {
        const cached = jobsCache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < CACHE_TTL_JOBS) {
          console.log(`[Trak Proxy] Cache HIT for jobs. Serving ${Array.isArray(cached.data) ? cached.data.length : cached.data.items?.length || 0} items.`);
          return res.json(cached.data);
        }
      }

      // Force page 1 for the initial loader query
      queryParams.set("page", "1");
      const firstPageUrl = `https://api.trak.co/jobs?${queryParams.toString()}`;
      console.log(`[Trak Proxy] Querying jobs (Page 1): ${firstPageUrl}`);
      
      const response = await fetch(firstPageUrl, {
        method: "GET",
        headers: {
          "ttrak-key": apiKey as string,
          "Accept": "application/json"
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        return res.status(response.status).json({
          error: `Trak API returned error code ${response.status}`,
          details: errorText
        });
      }

      const data = await response.json();

      let jobsList: any[] = [];
      let pageCount = 1;
      let totalCount = 0;
      let isEnveloped = false;

      // Extract items from first page response
      if (Array.isArray(data)) {
        jobsList = data;
      } else if (data && typeof data === "object") {
        if (Array.isArray(data.items)) {
          jobsList = data.items;
          isEnveloped = true;
        } else if (Array.isArray(data.data)) {
          jobsList = data.data;
          isEnveloped = true;
        } else {
          const fallbackArrKey = Object.keys(data).find(k => Array.isArray(data[k]));
          if (fallbackArrKey) {
            jobsList = data[fallbackArrKey];
            isEnveloped = true;
          }
        }

        if (data._meta) {
          pageCount = Number(data._meta.pageCount || 1);
          totalCount = Number(data._meta.totalCount || 0);
        }
      }

      // Read standard headers pagination parameters
      const pageCountHeader = response.headers.get("X-Pagination-Page-Count") || response.headers.get("x-pagination-page-count");
      const totalCountHeader = response.headers.get("X-Pagination-Total-Count") || response.headers.get("x-pagination-total-count");

      if (pageCountHeader) {
        pageCount = Number(pageCountHeader);
      }
      if (totalCountHeader) {
        totalCount = Number(totalCountHeader);
      }

      console.log(`[Trak Proxy] Page 1 loaded ${jobsList.length} jobs. Explicit pageCount: ${pageCount}, totalCount: ${totalCount}`);

      let finalLimitPages = pageCount;
      let implicitFallback = false;

      // Safe-crawling check
      if (finalLimitPages <= 1 && jobsList.length === 100) {
        console.log(`[Trak Proxy] Suspecting implicit pagination (exactly 100 entries returned). Running multi-page sequence fetch...`);
        finalLimitPages = 15; // Set safe limit for crawling
        implicitFallback = true;
      }

      const safePageLimit = Math.min(finalLimitPages, 30); // Prevent long lockups

      // Optimize page crawl using Promise.all parallel fetching!
      if (safePageLimit > 1) {
        const pagesToFetch = Array.from({ length: safePageLimit - 1 }, (_, i) => i + 2);
        console.log(`[Trak Proxy] Parallel crawling ${pagesToFetch.length} pages: ${pagesToFetch.join(", ")}...`);

        const pagePromises = pagesToFetch.map(async (p) => {
          const pageQueryParams = new URLSearchParams(queryParams.toString());
          pageQueryParams.set("page", String(p));
          const pageUrl = `https://api.trak.co/jobs?${pageQueryParams.toString()}`;

          try {
            const pRes = await fetch(pageUrl, {
              method: "GET",
              headers: {
                "ttrak-key": apiKey as string,
                "Accept": "application/json"
              }
            });

            if (pRes.ok) {
              const pData = await pRes.json();
              let pItems: any[] = [];
              if (Array.isArray(pData)) {
                pItems = pData;
              } else if (pData && typeof pData === "object") {
                if (Array.isArray(pData.items)) {
                  pItems = pData.items;
                } else if (Array.isArray(pData.data)) {
                  pItems = pData.data;
                } else {
                  const fallbackArrKey = Object.keys(pData).find(k => Array.isArray(pData[k]));
                  if (fallbackArrKey) {
                    pItems = pData[fallbackArrKey];
                  }
                }
              }
              return { page: p, items: pItems };
            } else {
              console.warn(`[Trak Proxy] Page ${p} returned non-ok code: ${pRes.status}`);
              return { page: p, items: [] };
            }
          } catch (pErr: any) {
            console.error(`[Trak Proxy] Exception retrieving page ${p}:`, pErr.message);
            return { page: p, items: [] };
          }
        });

        const fetchedPages = await Promise.all(pagePromises);

        // Sort results to retain correct pagination sequence
        fetchedPages.sort((a, b) => a.page - b.page);

        // Append items and break early if an empty page was fetched
        for (const pageRes of fetchedPages) {
          if (pageRes.items.length === 0) {
            console.log(`[Trak Proxy] Concurrently fetched page ${pageRes.page} was empty. Halting merge.`);
            break;
          }
          jobsList.push(...pageRes.items);
          if (implicitFallback && pageRes.items.length < 100) {
            console.log(`[Trak Proxy] Concurrently fetched page ${pageRes.page} was sub-maximum count (${pageRes.items.length}). Halting merge.`);
            break;
          }
        }
      }

      console.log(`[Trak Proxy] Jobs crawl completed. Consolidating ${jobsList.length} records.`);

      // Fetch individual job details to expand 'assignedUsers' for each job row, optimized using in-memory caches & batch concurrency
      if (jobsList.length > 0) {
        const jobsNeedingExpansion = jobsList.filter((job: any) => {
          if (!job || !job.id) return false;

          // Optimization 1: Skip if users/assigned details are already expanded in the main list query
          const existingAssigned = job.assignedUsers || job.assignedusers || job.assigned_users || job.users;
          if (Array.isArray(existingAssigned) && existingAssigned.length > 0) {
            return false;
          }

          // Optimization 2: Check our in-memory cache
          if (!bypassCache) {
            const cached = individualJobCache.get(job.id);
            if (cached && Date.now() - cached.timestamp < CACHE_TTL_INDIVIDUAL_JOB) {
              const assignedList = cached.data;
              job.assignedusers = assignedList;
              job.assignedUsers = assignedList;
              job.assigned_users = assignedList;
              job.users = assignedList;
              return false; // Already resolved from cache
            }
          }
          return true;
        });

        console.log(`[Trak Proxy] Network expansions needed for ${jobsNeedingExpansion.length} / ${jobsList.length} jobs.`);

        if (jobsNeedingExpansion.length > 0) {
          // Increase batch concurrency to 30 to speed up query duration
          const batchSize = 30;
          for (let i = 0; i < jobsNeedingExpansion.length; i += batchSize) {
            const batch = jobsNeedingExpansion.slice(i, i + batchSize);
            await Promise.all(
              batch.map(async (job: any) => {
                try {
                  const detailUrl = `https://api.trak.co/jobs/${job.id}?expand=assignedUsers`;
                  const dRes = await fetch(detailUrl, {
                    method: "GET",
                    headers: {
                      "ttrak-key": apiKey as string,
                      "Accept": "application/json"
                    }
                  });
                  if (dRes.ok) {
                    const detailData = await dRes.json();
                    if (detailData) {
                      const assignedList = detailData.assignedUsers || detailData.assignedusers || detailData.assigned_users;
                      if (assignedList) {
                        job.assignedusers = assignedList;
                        job.assignedUsers = assignedList;
                        job.assigned_users = assignedList;
                        job.users = assignedList;

                        // Save detail records in cache
                        individualJobCache.set(job.id, {
                          data: assignedList,
                          timestamp: Date.now()
                        });
                      } else if (detailData.users) {
                        job.users = detailData.users;
                        individualJobCache.set(job.id, {
                          data: detailData.users,
                          timestamp: Date.now()
                        });
                      }
                    }
                  } else {
                    console.warn(`[Trak Proxy] Failed to fetch expansion for job ${job.id}: status ${dRes.status}`);
                  }
                } catch (err: any) {
                  console.error(`[Trak Proxy] Exception expanding job ${job.id}:`, err.message);
                }
              })
            );
          }
        }
        console.log(`[Trak Proxy] Finished fetching individual job expansions.`);
      }

      // Assemble final payload matching the original envelope
      const responseData = isEnveloped ? {
        items: jobsList,
        _meta: {
          pageCount: safePageLimit,
          totalCount: jobsList.length,
          currentPage: 1,
          perPage: 100
        }
      } : jobsList;

      // Update Cache
      jobsCache.set(cacheKey, {
        data: responseData,
        timestamp: Date.now()
      });

      res.json(responseData);
    } catch (error: any) {
      console.error("Express proxy jobs endpoint error:", error);
      res.status(500).json({
        error: "Internal Server Error forwarding request to Trak API",
        details: error.message
      });
    }
  });

  // API router to proxy Trak job statuses request with multi-page support
  app.get("/api/job-statuses", async (req, res) => {
    // List of standard statuses with Hex colours to use as fallback
    const FALLBACK_STATUSES = [
      { name: "Priority Quote", job_type_id: null, hidden_in_filter: false, available_to_subbie: false, is_active: true, colour: "FFE4E6" }, 
      { name: "Ready to Quote", job_type_id: null, hidden_in_filter: false, available_to_subbie: false, is_active: true, colour: "D1FAE5" }, 
      { name: "Revise Quote", job_type_id: null, hidden_in_filter: false, available_to_subbie: false, is_active: true, colour: "FEF3C7" }, 
      { name: "Estimate Required", job_type_id: null, hidden_in_filter: false, available_to_subbie: false, is_active: true, colour: "E0E7FF" }, 
      { name: "Detail Requested", job_type_id: null, hidden_in_filter: false, available_to_subbie: false, is_active: true, colour: "F3E8FF" }, 
      { name: "Measure Booked", job_type_id: null, hidden_in_filter: false, available_to_subbie: false, is_active: true, colour: "CCFBF1" }, 
      { name: "Contact Attempted", job_type_id: null, hidden_in_filter: false, available_to_subbie: false, is_active: true, colour: "F1F5F9" }, 
      { name: "Measure Required", job_type_id: null, hidden_in_filter: false, available_to_subbie: false, is_active: true, colour: "E0F2FE" }, 
      { name: "New", job_type_id: null, hidden_in_filter: false, available_to_subbie: false, is_active: true, colour: "E2E8F0" } 
    ];

    try {
      const apiKeyHeader = req.headers["ttrak-key"];
      const apiKey = apiKeyHeader || process.env.TRAK_API_KEY;

      if (!apiKey) {
        return res.status(401).json({
          error: "API key is missing.",
          details: "Please configure your Trak API Key in the settings panel."
        });
      }

      const bypassCache = req.headers["x-bypass-cache"] === "true";
      const cacheKey = `${apiKey}`;

      if (!bypassCache) {
        const cached = statusesCache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < CACHE_TTL_STATUSES) {
          console.log(`[Trak Proxy] Cache HIT for job statuses.`);
          return res.json(cached.data);
        }
      }

      // Probing most likely TradeTrak URLs for status collection
      const candidates = [
        "https://api.trak.co/job-statuses",
        "https://api.trak.co/job_statuses",
        "https://api.trak.co/statuses",
        "https://api.trak.co/jobs/statuses",
        "https://api.trak.co/job-status"
      ];

      // Re-order candidates list to test working cached URL first
      const searchUrls = cachedWorkingStatusUrl
        ? [cachedWorkingStatusUrl, ...candidates.filter(c => c !== cachedWorkingStatusUrl)]
        : candidates;

      for (const baseUrl of searchUrls) {
        try {
          const separator = baseUrl.includes("?") ? "&" : "?";
          const firstPageUrl = `${baseUrl}${separator}per-page=100&page=1`;
          console.log(`[Trak Proxy] Probing status URL: ${baseUrl}`);

          const response = await fetch(firstPageUrl, {
            method: "GET",
            headers: {
              "ttrak-key": apiKey as string,
              "Accept": "application/json"
            }
          });

          if (response.ok) {
            cachedWorkingStatusUrl = baseUrl; // Retain working url
            const data = await response.json();
            console.log(`[Trak Proxy] Success hitting ${baseUrl}:`, typeof data);

            // Extract page 1 list
            let pageItems: any[] = [];
            if (Array.isArray(data)) {
              pageItems = data;
            } else if (data && typeof data === "object") {
              if (Array.isArray(data.items)) {
                pageItems = data.items;
              } else if (Array.isArray(data.statuses)) {
                pageItems = data.statuses;
              } else if (Array.isArray(data.data)) {
                pageItems = data.data;
              } else {
                // Try finding any array parameter
                const fallbackArrKey = Object.keys(data).find(k => Array.isArray(data[k]));
                if (fallbackArrKey) {
                  pageItems = data[fallbackArrKey];
                }
              }
            }

            let allStatuses = [...pageItems];

            // Resolve pagination
            let pageCount = 1;
            let hasExplicitMeta = false;
            if (data && typeof data === "object" && data._meta) {
              pageCount = Number(data._meta.pageCount || 1);
              hasExplicitMeta = true;
            }

            if (hasExplicitMeta && pageCount > 1) {
              console.log(`[Trak Proxy] Explicit paginated metadata detected: ${pageCount} pages. Retrieving remaining pages in parallel...`);
              const statusPages = Array.from({ length: pageCount - 1 }, (_, i) => i + 2);
              const statusPagesPromises = statusPages.map(async (p) => {
                const pageUrl = `${baseUrl}${separator}per-page=100&page=${p}`;
                try {
                  const pRes = await fetch(pageUrl, {
                    method: "GET",
                    headers: {
                      "ttrak-key": apiKey as string,
                      "Accept": "application/json"
                    }
                  });
                  if (pRes.ok) {
                    const pData = await pRes.json();
                    let pItems: any[] = [];
                    if (Array.isArray(pData)) {
                      pItems = pData;
                    } else if (pData && typeof pData === "object") {
                      if (Array.isArray(pData.items)) {
                        pItems = pData.items;
                      } else if (Array.isArray(pData.statuses)) {
                        pItems = pData.statuses;
                      } else if (Array.isArray(pData.data)) {
                        pItems = pData.data;
                      } else {
                        const fallbackArrKey = Object.keys(pData).find(k => Array.isArray(pData[k]));
                        if (fallbackArrKey) {
                          pItems = pData[fallbackArrKey];
                        }
                      }
                    }
                    return pItems;
                  }
                } catch (pErr: any) {
                  console.error(`[Trak Proxy] Failed to fetch status page ${p}:`, pErr.message);
                }
                return [];
              });

              const resolvedPages = await Promise.all(statusPagesPromises);
              for (const items of resolvedPages) {
                if (items.length > 0) {
                  allStatuses.push(...items);
                }
              }
            } else if (!hasExplicitMeta && pageItems.length > 0) {
              // Implicit / fallback pagination: query subsequent pages concurrently (up to 5 pages)
              console.log(`[Trak Proxy] Implicit pagination fallback. Querying pages 2-5 in parallel...`);
              const fallbackPages = [2, 3, 4, 5];
              const fallbackPromises = fallbackPages.map(async (p) => {
                const pageUrl = `${baseUrl}${separator}per-page=100&page=${p}`;
                try {
                  const pRes = await fetch(pageUrl, {
                    method: "GET",
                    headers: {
                      "ttrak-key": apiKey as string,
                      "Accept": "application/json"
                    }
                  });
                  if (pRes.ok) {
                    const pData = await pRes.json();
                    let pItems: any[] = [];
                    if (Array.isArray(pData)) {
                      pItems = pData;
                    } else if (pData && typeof pData === "object") {
                      if (Array.isArray(pData.items)) {
                        pItems = pData.items;
                      } else if (Array.isArray(pData.statuses)) {
                        pItems = pData.statuses;
                      } else if (Array.isArray(pData.data)) {
                        pItems = pData.data;
                      } else {
                        const fallbackArrKey = Object.keys(pData).find(k => Array.isArray(pData[k]));
                        if (fallbackArrKey) {
                          pItems = pData[fallbackArrKey];
                        }
                      }
                    }
                    return { page: p, items: pItems };
                  }
                } catch (pErr: any) {
                  console.warn(`[Trak Proxy] Error probing fallback page ${p}:`, pErr.message);
                }
                return { page: p, items: [] };
              });

              const resolvedFallbacks = await Promise.all(fallbackPromises);
              resolvedFallbacks.sort((a, b) => a.page - b.page);

              for (const fbResult of resolvedFallbacks) {
                if (fbResult.items.length === 0) break;
                allStatuses.push(...fbResult.items);
              }
            }

            console.log(`[Trak Proxy] Completed status loading. Consolidated status count: ${allStatuses.length}`);
            
            const responseData = {
              sourceUrl: baseUrl,
              statuses: allStatuses
            };

            // Save to status cache
            statusesCache.set(cacheKey, {
              data: responseData,
              timestamp: Date.now()
            });

            return res.json(responseData);
          } else {
            console.log(`[Trak Proxy] Candidate status endpoint ${baseUrl} returned non-ok code: ${response.status}`);
          }
        } catch (candidateErr: any) {
          console.log(`[Trak Proxy] Candidate status endpoint ${baseUrl} returned exception: ${candidateErr.message}`);
        }
      }

      // Fallback
      console.log(`[Trak Proxy] Falling back to preconfigured local status configurations.`);
      const responseData = {
        sourceUrl: "fallback",
        statuses: FALLBACK_STATUSES
      };

      return res.json(responseData);

    } catch (error: any) {
      console.error("Proxy job-statuses error:", error);
      res.status(500).json({
        error: "Proxy internal controller error",
        details: error.message
      });
    }
  });

  // API router to proxy Trak scheduler bookings with parallel crawling of all pagination pages
  app.get("/api/scheduler", async (req, res) => {
    // List of standard mock scheduler bookings as fallback for demo mode
    const FALLBACK_SCHEDULER = [
      {
        id: 10001,
        job_id: 10457,
        start_date: "2026-05-29T14:00:00Z",
        user: { name: "Michael Scott" }
      }
    ];

    try {
      const apiKeyHeader = req.headers["ttrak-key"];
      const apiKey = apiKeyHeader || process.env.TRAK_API_KEY;

      if (!apiKey) {
        console.log("[Trak Proxy] Scheduler requested without API Key - returning fallback");
        return res.json(FALLBACK_SCHEDULER);
      }

      const bypassCache = req.headers["x-bypass-cache"] === "true";
      const cacheKey = `${apiKey}`;

      if (!bypassCache) {
        const cached = schedulerCache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < CACHE_TTL_SCHEDULER) {
          console.log(`[Trak Proxy] Cache HIT for scheduler bookings.`);
          return res.json(cached.data);
        }
      }

      console.log(`[Trak Proxy] Querying Trak Scheduler (Page 1) with per-page=100`);
      const page1Url = "https://api.trak.co/scheduler?per-page=100&page=1";
      const response = await fetch(page1Url, {
        method: "GET",
        headers: {
          "ttrak-key": apiKey as string,
          "Accept": "application/json"
        }
      });

      if (!response.ok) {
        console.warn(`[Trak Proxy] Scheduler API returned code ${response.status}. Falling back gracefully.`);
        return res.json(FALLBACK_SCHEDULER);
      }

      const data = await response.json();
      console.log(`[Trak Proxy] Scheduler page 1 loaded.`);

      let schedulerList: any[] = [];
      let pageCount = 1;
      let totalCount = 0;
      let isEnveloped = false;

      // Extract array from first page response
      if (Array.isArray(data)) {
        schedulerList = data;
      } else if (data && typeof data === "object") {
        if (Array.isArray(data.items)) {
          schedulerList = data.items;
          isEnveloped = true;
        } else if (Array.isArray(data.data)) {
          schedulerList = data.data;
          isEnveloped = true;
        } else if (Array.isArray(data.scheduler)) {
          schedulerList = data.scheduler;
          isEnveloped = true;
        } else {
          const fallbackArrKey = Object.keys(data).find(k => Array.isArray(data[k]));
          if (fallbackArrKey) {
            schedulerList = data[fallbackArrKey];
            isEnveloped = true;
          }
        }

        if (data._meta) {
          pageCount = Number(data._meta.pageCount || 1);
          totalCount = Number(data._meta.totalCount || 0);
        }
      }

      // Read standard header pagination parameters
      const pageCountHeader = response.headers.get("X-Pagination-Page-Count") || response.headers.get("x-pagination-page-count");
      const totalCountHeader = response.headers.get("X-Pagination-Total-Count") || response.headers.get("x-pagination-total-count");

      if (pageCountHeader) {
        pageCount = Number(pageCountHeader);
      }
      if (totalCountHeader) {
        totalCount = Number(totalCountHeader);
      }

      console.log(`[Trak Proxy] Scheduler page 1 items: ${schedulerList.length}. Explicit pages: ${pageCount}, totalCount: ${totalCount}`);

      let finalLimitPages = pageCount;
      let implicitFallback = false;

      // Safe-crawling check for scheduler if exactly 100 elements are returned (indicating potential hidden pages)
      if (finalLimitPages <= 1 && schedulerList.length === 100) {
        console.log(`[Trak Proxy] Suspecting implicit pagination in scheduler (exactly 100 entries). Running multi-page crawl...`);
        finalLimitPages = 15; // Set safe limit for crawling
        implicitFallback = true;
      }

      const safePageLimit = Math.min(finalLimitPages, 30); // Prevent long lockups

      if (safePageLimit > 1) {
        const pagesToFetch = Array.from({ length: safePageLimit - 1 }, (_, i) => i + 2);
        console.log(`[Trak Proxy] Parallel crawling ${pagesToFetch.length} scheduler pages: ${pagesToFetch.join(", ")}...`);

        const pagePromises = pagesToFetch.map(async (p) => {
          const pageUrl = `https://api.trak.co/scheduler?per-page=100&page=${p}`;
          try {
            const pRes = await fetch(pageUrl, {
              method: "GET",
              headers: {
                "ttrak-key": apiKey as string,
                "Accept": "application/json"
              }
            });

            if (pRes.ok) {
              const pData = await pRes.json();
              let pItems: any[] = [];
              if (Array.isArray(pData)) {
                pItems = pData;
              } else if (pData && typeof pData === "object") {
                if (Array.isArray(pData.items)) {
                  pItems = pData.items;
                } else if (Array.isArray(pData.data)) {
                  pItems = pData.data;
                } else if (Array.isArray(pData.scheduler)) {
                  pItems = pData.scheduler;
                } else {
                  const fallbackArrKey = Object.keys(pData).find(k => Array.isArray(pData[k]));
                  if (fallbackArrKey) {
                    pItems = pData[fallbackArrKey];
                  }
                }
              }
              return { page: p, items: pItems };
            } else {
              console.warn(`[Trak Proxy] Scheduler Page ${p} returned non-ok: ${pRes.status}`);
              return { page: p, items: [] };
            }
          } catch (pErr: any) {
            console.error(`[Trak Proxy] Exception retrieving scheduler page ${p}:`, pErr.message);
            return { page: p, items: [] };
          }
        });

        const fetchedPages = await Promise.all(pagePromises);
        fetchedPages.sort((a, b) => a.page - b.page);

        for (const pageRes of fetchedPages) {
          if (pageRes.items.length === 0) {
            console.log(`[Trak Proxy] Concurrently fetched scheduler page ${pageRes.page} was empty. Halting merge.`);
            break;
          }
          schedulerList.push(...pageRes.items);
          if (implicitFallback && pageRes.items.length < 100) {
            console.log(`[Trak Proxy] Concurrently fetched scheduler page ${pageRes.page} was sub-maximum count (${pageRes.items.length}). Halting.`);
            break;
          }
        }
      }

      console.log(`[Trak Proxy] Scheduler crawl completed. Consolidated ${schedulerList.length} scheduler records.`);

      // Assemble final envelope or collection
      const responseData = isEnveloped ? {
        items: schedulerList,
        _meta: {
          pageCount: safePageLimit,
          totalCount: schedulerList.length,
          currentPage: 1,
          perPage: 100
        }
      } : schedulerList;

      schedulerCache.set(cacheKey, {
        data: responseData,
        timestamp: Date.now()
      });

      return res.json(responseData);

    } catch (error: any) {
      console.error("[Trak Proxy] Scheduler proxy exception:", error.message);
      return res.json(FALLBACK_SCHEDULER);
    }
  });

  // Serve static assets or mount Vite dev middleware
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Trak Server] Listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
