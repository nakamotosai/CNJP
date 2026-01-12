
import { GoogleGenerativeAI } from "@google/generative-ai";

const API_KEY = process.env.GOOGLE_API_KEY || "AIzaSyAccHxx9xdNR8ZW6ux92XffIeF65UTzlx8";
const genAI = new GoogleGenerativeAI(API_KEY);

console.log("[Gemini] Initializing Google Generative AI with model: gemma-3-27b-it");

export const gemmaModel = genAI.getGenerativeModel({
    model: "gemma-3-27b-it",
    generationConfig: {
        temperature: 0.6,
        maxOutputTokens: 4096,

    }
});
