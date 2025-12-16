import { GoogleGenAI, Type, Schema } from "@google/genai";
import { AppMode, ProductAnalysis, SectionData, Template } from "../types";

// Initialize Gemini Client
// NOTE: Process.env.API_KEY is injected by the environment.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const MODEL_TEXT_VISION = 'gemini-2.5-flash';
const MODEL_IMAGE_GEN = 'gemini-2.5-flash-image'; 

/**
 * Helper to convert Blob/File to Base64 string without data prefix
 */
export const fileToGenerativePart = async (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      // Remove data:image/png;base64, prefix
      const base64Data = base64String.split(',')[1];
      resolve(base64Data);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

/**
 * Schema for the product analysis output
 */
const productAnalysisSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    productName: { type: Type.STRING, description: "Suggested product name in Korean" },
    detectedCategory: { type: Type.STRING, description: "Product category" },
    mainFeatures: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "List of 3-5 key features in Korean"
    },
    marketingCopy: { type: Type.STRING, description: "Persuasive marketing intro copy (2-3 sentences) in Korean" },
    sections: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          title: { type: Type.STRING, description: "Section header in Korean" },
          content: { type: Type.STRING, description: "Detailed section body text in Korean" },
          imagePrompt: { type: Type.STRING, description: "Prompt to generate an image for this section (in English)" },
        },
        required: ["id", "title", "content", "imagePrompt"]
      }
    }
  },
  required: ["productName", "mainFeatures", "marketingCopy", "sections"]
};

/**
 * Extract template structure from a reference image
 */
export const extractTemplateFromImage = async (
  base64Image: string,
  mimeType: string
): Promise<Template> => {
  const prompt = `
    Analyze this product detail page image to create a reusable template.
    1. Identify the structural flow (Layout).
    2. Break it down into logical sections (e.g., Intro, Problems, Solution, Certifications, Reviews, FAQ).
    3. For each section, provide a generic 'title' (e.g., "Main Feature 1", "User Reviews") and a 'content' description describing what kind of text usually goes here.
    4. Crucially, provide an 'imagePrompt' that describes the visual style and composition of that section (e.g., "A grid layout showing 3 color variations", "Close up of texture").
    
    Output strictly in JSON format.
  `;

  try {
    const response = await ai.models.generateContent({
      model: MODEL_TEXT_VISION,
      contents: {
        parts: [
          { inlineData: { mimeType, data: base64Image } },
          { text: prompt }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: productAnalysisSchema,
        temperature: 0.2,
      }
    });

    const text = response.text;
    if (!text) throw new Error("No response from Gemini");
    
    const analysis = JSON.parse(text) as ProductAnalysis;
    
    return {
      id: `tpl-${Date.now()}`,
      name: analysis.productName || "새 템플릿",
      description: analysis.marketingCopy || "이미지에서 추출된 템플릿",
      sections: analysis.sections,
      createdAt: Date.now()
    };
  } catch (error) {
    console.error("Template extraction failed:", error);
    throw error;
  }
};

/**
 * Analyze image(s) and generate product details and section structure
 * Updated to accept multiple images
 */
export const analyzeProductImage = async (
  base64Images: string[],
  mimeTypes: string[],
  mode: AppMode,
  template?: Template | null
): Promise<ProductAnalysis> => {
  
  let prompt = "";
  
  if (template) {
    // TEMPLATE MODE
    const templateStructure = JSON.stringify(template.sections.map(s => ({
      title: s.title,
      description_of_content_needed: s.content,
      visual_style: s.imagePrompt
    })));

    prompt = `
      You are an expert e-commerce merchandiser.
      I have a specific "Winning Layout Template" that I want to apply to a new product.
      
      Input Image(s): Photos of the product to sell.
      Target Template Structure: ${templateStructure}
      
      Tasks:
      1. Analyze ALL input images to fully understand the product (front, back, details, etc.).
      2. Fill in the "Target Template Structure" with content specific to this product.
      3. For each section in the template:
         - Keep the original structural intent.
         - Write persuasive Korean content for 'title' and 'content'.
         - Refine the 'imagePrompt' to combine the Template's Visual Style with the Input Product's visual details found in the images.
    `;
  } else if (mode === AppMode.CREATION) {
    prompt = `
      You are an expert e-commerce merchandiser. 
      Analyze the provided product image(s).
      1. Identify the product by looking at all angles/details provided.
      2. Create a catchy Product Name in Korean.
      3. List key features visible or implied.
      4. Write a short, persuasive marketing copy in Korean.
      5. Suggest a structure for a "Detail Page" (Landing Page) with 4-5 distinct sections (e.g., Intro, Feature 1, Feature 2, Usage, Specs).
      6. For each section, provide an English prompt that could be used to generate a supporting image.
    `;
  } else {
    // Mode B: Localization
    prompt = `
      You are an expert translator and localization specialist for the Korean market.
      The provided image(s) are screenshots of an existing product detail page.
      
      Tasks:
      1. Extract the content and structure from all images.
      2. Localize the content into natural, persuasive Korean.
      3. Maintain the original section flow.
      4. For 'imagePrompt', describe the visual content of each section so it can be regenerated or replaced.
         If text exists in the image, instruct to replace it with Korean translation in the prompt.
    `;
  }

  try {
    // Construct parts array with multiple images
    const imageParts = base64Images.map((b64, index) => ({
      inlineData: { mimeType: mimeTypes[index], data: b64 }
    }));

    const response = await ai.models.generateContent({
      model: MODEL_TEXT_VISION,
      contents: {
        parts: [
          ...imageParts, // Add all images
          { text: prompt }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: productAnalysisSchema,
        temperature: 0.4, 
      }
    });

    const text = response.text;
    if (!text) throw new Error("No response from Gemini");

    return JSON.parse(text) as ProductAnalysis;
  } catch (error) {
    console.error("Analysis failed:", error);
    throw error;
  }
};

/**
 * Generate a new image for a section using Gemini
 */
export const generateSectionImage = async (
  prompt: string,
  referenceImageBase64?: string,
  referenceMimeType?: string,
  mode: AppMode = AppMode.CREATION
): Promise<string> => {
  try {
    let fullPrompt = "";
    
    if (mode === AppMode.LOCALIZATION) {
       fullPrompt = `High quality product image. Based on the reference, recreate the visual content. ${prompt}`;
    } else {
       fullPrompt = `Professional product photography, high quality, 4k: ${prompt}`;
    }

    const parts: any[] = [{ text: fullPrompt }];
    
    if (referenceImageBase64 && referenceMimeType) {
       parts.unshift({
         inlineData: {
           data: referenceImageBase64,
           mimeType: referenceMimeType
         }
       });
    }

    const response = await ai.models.generateContent({
      model: MODEL_IMAGE_GEN,
      contents: { parts },
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
      }
    }
    
    throw new Error("No image generated");
  } catch (error) {
    console.error("Image generation failed:", error);
    return `https://picsum.photos/800/800?random=${Math.random()}`;
  }
};