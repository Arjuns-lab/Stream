import { GoogleGenAI, Type } from "@google/genai";
import { Movie } from "../types";

export const getGeminiRecommendations = async (
  history: Movie[], 
  allMovies: Movie[]
): Promise<Movie[]> => {
  try {
    const apiKey = process.env.API_KEY;
    if (!apiKey) {
        console.warn("No API Key provided for Gemini");
        return allMovies.slice(0, 3); // Fallback
    }

    const ai = new GoogleGenAI({ apiKey });
    
    const historyTitles = history.map(m => m.title).join(", ");
    const availableTitles = allMovies.map(m => m.title).join(", ");

    const prompt = `
      User has watched: ${historyTitles || "Nothing yet"}.
      Available movies: ${availableTitles}.
      
      Recommend 3 movies from the available list that the user might like.
      Return strictly a JSON array of strings containing ONLY the titles of the recommended movies.
    `;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
            type: Type.ARRAY,
            items: { type: Type.STRING }
        }
      }
    });

    const recommendedTitles = JSON.parse(response.text || "[]");
    return allMovies.filter(m => recommendedTitles.includes(m.title));
  } catch (error) {
    console.error("Gemini recommendation error:", error);
    return allMovies.slice(0, 3); // Fallback
  }
};

export const searchMoviesWithGemini = async (
    query: string,
    allMovies: Movie[]
): Promise<Movie[]> => {
    try {
        const apiKey = process.env.API_KEY;
        if (!apiKey) {
            // Simple fuzzy match fallback
            return allMovies.filter(m => 
                m.title.toLowerCase().includes(query.toLowerCase()) || 
                m.description.toLowerCase().includes(query.toLowerCase())
            );
        }

        const ai = new GoogleGenAI({ apiKey });
        const availableData = allMovies.map(m => `${m.title}: ${m.description}`).join("\n");

        const prompt = `
            User query: "${query}"
            
            Available content:
            ${availableData}
            
            Find the titles of the movies that best match the user query's intent (semantic search).
            Return strictly a JSON array of strings containing ONLY the exact titles.
        `;

        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING }
                }
            }
        });

        const matchedTitles = JSON.parse(response.text || "[]");
        return allMovies.filter(m => matchedTitles.includes(m.title));

    } catch (error) {
        console.error("Gemini search error", error);
        return allMovies.filter(m => m.title.toLowerCase().includes(query.toLowerCase()));
    }
}
