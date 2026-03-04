import type { Request, Response, NextFunction, RequestHandler } from "express";
import { serverCache } from "../lib/cache.js";

/**
 * Higher-order function to create a caching middleware.
 * @param ttlSeconds - Time to live in seconds (default 60s)
 */
export function createCacheMiddleware(ttlSeconds: number = 60): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    // Only cache GET requests
    if (req.method !== "GET") {
      return next();
    }

    // Build a unique cache key based on URL and user context (scope)
    const userPart = req.appUser 
      ? `${req.appUser.role}:${req.appUser.stateId || "all"}:${req.appUser.boardId || "all"}`
      : req.appConsumer 
        ? `consumer:${req.appConsumer.id}`
        : "anon";
        
    const cacheKey = `api:${req.originalUrl}:${userPart}`;

    // Check cache
    const cachedData = serverCache.get(cacheKey);
    if (cachedData) {
      // res.set("X-Cache", "HIT");
      res.json(cachedData);
      return;
    }

    // Intercept res.json to store the result in cache
    const originalJson = res.json;
    res.json = function (body: any) {
      // Only cache successful responses
      if (res.statusCode >= 200 && res.statusCode < 300) {
        serverCache.set(cacheKey, body, ttlSeconds);
      }
      return originalJson.call(this, body);
    };

    next();
  };
}
