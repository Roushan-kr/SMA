import { logger } from "../lib/logger.js";

export interface AiClassificationResult {
  category: string;
  confidence: number;
  suggestedReply: string;
}

export class AiService {
  /**
   * MVP: Dummy AI classification based on keyword matching.
   * In a real version, this hits an OpenAI/Anthropic/Local LLM.
   */
  async classifyQuery(queryText: string): Promise<AiClassificationResult> {
    const textLower = queryText.toLowerCase();
    
    // Simulate AI thinking delay
    await new Promise((resolve) => setTimeout(resolve, 300));

    if (textLower.includes("bill") || textLower.includes("payment") || textLower.includes("charge")) {
      return {
        category: "Billing",
        confidence: 0.88, // > 0.85 means auto-resolve
        suggestedReply: "Your billing inquiry has been processed. Please check your latest Billing Report in the 'Billing' tab. If you believe there is an error in the reading, a recalculation can be requested.",
      };
    }

    if (textLower.includes("meter") || textLower.includes("fault") || textLower.includes("broken") || textLower.includes("reading")) {
      return {
        category: "Hardware/Meter",
        confidence: 0.75, // Requires human review
        suggestedReply: "We have noted your hardware issue. An engineer will be dispatched to verify your Smart Meter readings within 48 business hours. Please ensure someone is available at the premises.",
      };
    }

    if (textLower.includes("power") || textLower.includes("outage") || textLower.includes("cut")) {
      return {
        category: "Network/Outage",
        confidence: 0.92,
        suggestedReply: "We are aware of power fluctuations in your grid area and our field teams are already actively working to restore stability. We apologize for the inconvenience and expect resolution shortly.",
      };
    }

    // Fallback classification
    return {
      category: "General Inquiry",
      confidence: 0.60,
      suggestedReply: "Thank you for reaching out to SmartMeter Support. A human agent will review your inquiry and get back to you shortly.",
    };
  }
  
  /**
   * Process a batch of pending queries in the MVP.
   */
  async processBatch(queries: {id: string, queryText: string}[]): Promise<Map<string, AiClassificationResult>> {
    const results = new Map<string, AiClassificationResult>();
    for (const query of queries) {
      try {
        const result = await this.classifyQuery(query.queryText);
        results.set(query.id, result);
      } catch (error:any) {
        logger.error(`AI processing failed for query ${query.id}`, error );
      }
    }
    return results;
  }
}

export const aiService = new AiService();
