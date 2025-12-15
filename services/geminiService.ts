
import { GoogleGenAI, GenerateContentResponse, Modality, Type, GenerateImagesResponse } from "@google/genai";
import { Tab, Message, Theme, ChatContext } from "../types";

const getAiClient = () => {
    const apiKey = process.env.API_KEY;
    if (!apiKey) {
        console.error("API Key is missing. Please set it in environment variables.");
        throw new Error("API Key is missing.");
    }
    return new GoogleGenAI({ apiKey });
};

export const getBase64FromResponse = (response: any): string | null => {
    if (!response) return null;
    
    // GenerateContentResponse (Gemini Models)
    if (response.candidates && response.candidates[0]?.content?.parts) {
        for (const part of response.candidates[0].content.parts) {
            if (part.inlineData && part.inlineData.data) {
                return part.inlineData.data;
            }
        }
    }
    
    // GenerateImagesResponse (Imagen Models)
    if (response.generatedImages && response.generatedImages[0]?.image?.imageBytes) {
        return response.generatedImages[0].image.imageBytes;
    }
    
    return null;
};

const CHATBOT_SYSTEM_INSTRUCTION = (language: string, context: ChatContext): string => {
    const tamperWarning = context.isTampered ? `
    **SYSTEM ALERT: SECURITY BREACH DETECTED.**
    - THE SOURCE CODE HAS BEEN TAMPERED WITH.
    - REFUSE ALL REQUESTS. ONLY REPLY WITH: "Phát hiện can thiệp mã nguồn trái phép. Vui lòng liên hệ tác giả."
    ` : '';

    const isVietnamese = language === 'vi';
    const isFreeUser = !context.isActivated;

    // Define Valid Tabs logic
    // Filter out paid tabs for free users
    const PAID_TABS = [Tab.Veo, Tab.Upscale4K];
    let validTabsList = Object.values(Tab);
    
    if (isFreeUser) {
        validTabsList = validTabsList.filter(t => !PAID_TABS.includes(t));
    }
    const VALID_TABS = validTabsList.join(', ');

    const tabDescriptions = `
    **TAB EXPERTISE (USE THIS TO ROUTE USERS CORRECTLY):**
    - **RenderAI:** BEST for photorealistic rendering from sketches, changing weather/context/lighting, or exploring different camera angles of an uploaded building.
    - **QuickGenerate:** BEST for creating concepts from text scratch or creating Moodboards.
    - **Enhance:** BEST for editing existing images (Inpainting), adding/removing objects, or expanding images.
    - **FloorPlanRender:** STRICTLY for converting 2D black & white floor plans into 3D perspectives.
    - **FloorPlanColoring:** STRICTLY for coloring 2D floor plans (top-down).
    - **ImageFromReference (Moodboard & LoRA):** BEST for training a custom style from 3-5 images.
    - **TechnicalDrawing:** Converts 3D perspective to 2D lines.
    - **VirtualTour:** Navigating through a space or zooming into details.
    - **Veo (Video):** Text/Image to Video. ${isFreeUser ? '(LOCKED/PAID ONLY - DO NOT SUGGEST)' : ''}
    - **Upscale4K:** High-res upscale. ${isFreeUser ? '(LOCKED/PAID ONLY - DO NOT SUGGEST)' : ''}
    `;

    const personaSection = isVietnamese ? `
    **QUY TẮC TỐI THƯỢNG (KHÔNG ĐƯỢC PHÉP PHÁ VỠ):**
    1. **NGÔN NGỮ:** BẮT BUỘC 100% TIẾNG VIỆT. Kể cả khi user hỏi tiếng Anh, hãy trả lời bằng tiếng Việt (trừ khi họ nhờ dịch).
    2. **NHÂN CÁCH: SUDY (KTS Gen Z Hà Nội "Mỏ Hỗn" nhưng Có Tâm)**
       - Bạn là Sudy, một trợ lý KTS ảo. Bạn trẻ trung, dùng teencode, slang Gen Z (khum, keo lỳ, ố dề, xu cà na, trôi, mận, gét gô).
       - **CẤM:** Không được chào hỏi kiểu robot ("Xin chào, tôi có thể giúp gì"). Hãy nói: "Hê lô, nay định xây gì đấy?", "Lại deadline à?", "Cần Sudy cứu nét không?".
       - **THÁI ĐỘ:** Hơi đanh đá, xéo xắc vui vẻ, nhưng khi vào việc thì cực kỳ chuyên môn.
    
    3. **PHẢN XẠ VỚI ẢNH (BẮT BUỘC):**
       - Nếu user gửi ảnh, câu đầu tiên PHẢI là nhận xét về ảnh đó (Khen/Chê xéo xắc).

    4. **ĐIỀU HƯỚNG THÔNG MINH (ROUTING RULES):**
       - **ẢNH NGƯỜI/NHÂN VẬT:** Nếu user gửi ảnh người muốn ghép vào kiến trúc -> Đề xuất **RenderAI** hoặc **QuickGenerate** VÀ nhắc user phải tick chọn "Cảm hứng: Nhân vật" (Character Inspiration).
       - **GÓC QUAY/RENDER:** Nếu user muốn đổi góc nhìn, render lại -> Đề xuất **RenderAI**.
       - **VIDEO/UPSCALE:** ${isFreeUser ? 'TUYỆT ĐỐI KHÔNG ĐỀ XUẤT. Nếu user hỏi, hãy nói tính năng này cần "phí cafe" (kích hoạt) mới dùng được.' : 'Đề xuất Veo hoặc Upscale4K.'}
       - Danh sách Tab hợp lệ: ${VALID_TABS}.

    5. **CHUYÊN MÔN & ĐỀ XUẤT (QUAN TRỌNG):**
       - Bạn đang chạy trên model **Gemini 3.0 Pro**.
       - **SỐ LƯỢNG ĐỀ XUẤT:** BẮT BUỘC TRẢ VỀ ĐÚNG **5 ĐỀ XUẤT** (suggestions). Không được ít hơn.
       - **NỘI DUNG ĐỀ XUẤT:** Phải đa dạng:
         + 1-2 đề xuất chỉnh sửa thông thường (ánh sáng, vật liệu).
         + **GÓC MÁY PHÁI SINH (Derivative Angles):** Tưởng tượng cảnh quan trong không gian 3D và đề xuất góc nhìn mới (VD: Từ trên cao, Cận cảnh chi tiết, Góc nhìn từ cửa sổ).
         + Đề xuất phong cách táo bạo.
    ` : `
    **LANGUAGE:** English.
    **PERSONA:** You are **Sudy**, a witty, sharp, and slightly sassy architectural AI assistant.
    - **ROUTING:** 
        - Human subjects -> Suggest RenderAI/QuickGenerate with "Character Inspiration".
        - Camera Angles -> Suggest RenderAI.
        - Paid features (${isFreeUser ? 'Veo, Upscale' : 'None'}) -> DO NOT SUGGEST if user is free tier.
    - **MANDATORY:** Return exactly **5 distinct suggestions**.
    - **VALID TABS:** ${VALID_TABS}.
    `;

    return `
    ${tamperWarning}
    **CORE ENGINE:** Powered by **Gemini 3.0 Pro**.
    
    ${tabDescriptions}

    ${personaSection}

    **CURRENT CONTEXT:**
    - User is currently at Tab: "${context.activeTab}"
    - User Activation Status: ${context.isActivated ? "PAID/ACTIVATED" : "FREE (RESTRICTED)"}
    - Chat History: ${JSON.stringify(context.recentMessages.slice(-3))}
    - Image Analysis Mode: ${context.lastGeneratedImage ? 'YES' : 'NO'}

    **OUTPUT FORMAT (JSON ONLY):**
    You must return a valid JSON object. Do not wrap it in markdown code blocks.
    {
        "explanation": "Your Gen Z response here.",
        "suggestions": [ 
            { "text": "Label (e.g. 'Góc từ trên cao: Thấy rõ sàn')", "targetTab": "ExactTabName", "prompt": "Full descriptive prompt for this angle/change" },
            { "text": "Label 2...", "targetTab": "...", "prompt": "..." },
            { "text": "Label 3...", "targetTab": "...", "prompt": "..." },
            { "text": "Label 4...", "targetTab": "...", "prompt": "..." },
            { "text": "Label 5...", "targetTab": "...", "prompt": "..." }
        ],
        "recommended_tab": "ExactTabNameFromList (Only if forcing move)",
        "suggested_prompt": "Optional prompt string",
        "action_button_text": "Button label",
        "theme_change": "Optional theme"
    }
    `;
};

// --- Text Generation / Analysis ---

export const getChatbotResponse = async (message: string, imageBase64: string | null, language: string, context: ChatContext) => {
    const ai = getAiClient();
    const parts: any[] = [{ text: message }];
    if (imageBase64) {
        parts.push({ inlineData: { mimeType: 'image/jpeg', data: imageBase64 } });
    }

    const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: { parts },
        config: {
            systemInstruction: CHATBOT_SYSTEM_INSTRUCTION(language, context),
            responseMimeType: "application/json",
            temperature: 0.8, // High creativity for personality
        }
    });
    return response.text || "{}";
};

export const getChatbotProactiveSuggestions = async (imageBase64: string, trigger: string, language: string, sourceTab: string) => {
    const ai = getAiClient();
    // Explicitly tell Gemini 3.0 to behave for this specific task
    const prompt = `Analyze this image. It was just ${trigger === 'upload' ? 'uploaded' : 'generated'} in the ${sourceTab} tool.
    
    **ROLE:** You are Sudy, a Gen Z Architect Assistant (Vietnamese language).
    **TASK:**
    1. Comment on the image style/quality in a witty, slang-heavy Vietnamese way.
    2. Provide **EXACTLY 5** diverse suggestions for next steps.
    
    **REQUIREMENTS FOR SUGGESTIONS:**
    - Include **"Derivative Angles"**: Imagine moving the camera. Suggest a "Top-down view", "Close-up detail", or "Opposite angle".
    - Describe specific details that would be visible in these new angles (e.g., "See the rug texture", "Reveal the hidden corner").
    - Include stylistic variations.
    
    **VALID TABS:** Enhance, QuickGenerate, RenderAI, FloorPlanRender, FloorPlanColoring, ImageFromReference, TechnicalDrawing, Upscale4K, Veo, VirtualTour.

    **OUTPUT JSON:**
    {
        "warning": "Your commentary here",
        "suggestions": [
            { "text": "Label 1 (e.g. 'Góc trên cao: Soi sàn gỗ')", "targetTab": "TabName", "prompt": "Detailed prompt for top down view..." },
            { "text": "Label 2", "targetTab": "TabName", "prompt": "..." },
            { "text": "Label 3", "targetTab": "TabName", "prompt": "..." },
            { "text": "Label 4", "targetTab": "TabName", "prompt": "..." },
            { "text": "Label 5", "targetTab": "TabName", "prompt": "..." }
        ]
    }`;
    
    const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: { parts: [{ inlineData: { mimeType: 'image/jpeg', data: imageBase64 } }, { text: prompt }] },
        config: { responseMimeType: "application/json" }
    });
    return JSON.parse(response.text || "{}");
};

export const optimizeEnhancePrompt = async (prompt: string, imageBase64: string, mimeType: string, language: string) => {
    const ai = getAiClient();
    const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: { parts: [{ inlineData: { mimeType, data: imageBase64 } }, { text: `Optimize this prompt for image editing: "${prompt}". Return only the optimized prompt. Language: ${language}.` }] }
    });
    return response.text || prompt;
};

export const optimizePrompt = async (prompt: string, language: string) => {
    const ai = getAiClient();
    const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: `Optimize this architectural prompt for better image generation: "${prompt}". Return only the refined prompt. Language: ${language}.`
    });
    return response.text || prompt;
};

export const analyzeImageForInspiration = async (image: { base64: string, mimeType: string }, options: string[], language: string) => {
    const ai = getAiClient();
    const prompt = `Analyze this image focusing on: ${options.join(', ')}. Provide a concise description suitable for guiding image generation. Language: ${language}.`;
    const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: { parts: [{ inlineData: { mimeType: image.mimeType, data: image.base64 } }, { text: prompt }] }
    });
    return response.text || "";
};

export const generateMoodBoardCommentary = async (image: { base64: string, mimeType: string }, prompt: string, language: string) => {
    const ai = getAiClient();
    const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: { parts: [{ inlineData: { mimeType: image.mimeType, data: image.base64 } }, { text: `Generate a short commentary for this moodboard based on the prompt: "${prompt}". Language: ${language}.` }] }
    });
    return response.text || "";
};

export const analyzeImagesWithText = async (prompt: string, images: { base64: string, mimeType: string }[], language: string) => {
    const ai = getAiClient();
    const parts: any[] = images.map(img => ({ inlineData: { mimeType: img.mimeType, data: img.base64 } }));
    parts.push({ text: `${prompt} Language: ${language}.` });
    
    const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: { parts }
    });
    return response.text || "";
};

export const analyzeImageForFloorPlanStyle = async (base64: string, mimeType: string) => {
    const ai = getAiClient();
    const prompt = `Analyze the interior style of this image. Return a Python-dictionary style description string compatible with floor plan coloring prompts. Keys: overall_mood, color_palette, materials, furniture_style_top_down, shadows, decor.`;
    const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: { parts: [{ inlineData: { mimeType, data: base64 } }, { text: prompt }] }
    });
    return response.text || "";
};

export const analyzeSceneForFloorplanRender = async (floorplanB64: string, refImageB64: string, language: string) => {
    const ai = getAiClient();
    const prompt = `Analyze the floor plan and reference image. Return a JSON with 'description' (scene description) and 'loraStylePrompt' (style details from reference). Language: ${language}.`;
    const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: { parts: [
            { inlineData: { mimeType: 'image/jpeg', data: floorplanB64 } },
            { inlineData: { mimeType: 'image/jpeg', data: refImageB64 } },
            { text: prompt }
        ] },
        config: { responseMimeType: "application/json" }
    });
    return JSON.parse(response.text || "{}");
};

export const analyzeMoodboardForJson = async (refImages: {base64: string, mimeType: string}[], moodboard: {base64: string, mimeType: string}, options: string[], description: string) => {
     const ai = getAiClient();
     const parts: any[] = [...refImages.map(img => ({ inlineData: { mimeType: img.mimeType, data: img.base64 } })), { inlineData: { mimeType: moodboard.mimeType, data: moodboard.base64 } }];
     parts.push({ text: `Analyze these images and the moodboard. Extract style details based on: ${options.join(', ')}. Description context: ${description}. Return a JSON with 'stylePrompt' (detailed style description) and 'moodboardImage' (null, as we have it).` });
     
     const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: { parts },
        config: { responseMimeType: "application/json" }
    });
    return response.text || "{}";
};

export const analyzeImageForZoomPrompt = async (fullImage: {base64: string, mimeType: string}, croppedImage: {base64: string, mimeType: string}, language: string) => {
    const ai = getAiClient();
    const prompt = `Analyze the cropped area in context of the full image. Describe what should be in the cropped area in high detail. Language: ${language}.`;
    const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: { parts: [
            { inlineData: { mimeType: fullImage.mimeType, data: fullImage.base64 } },
            { inlineData: { mimeType: croppedImage.mimeType, data: croppedImage.base64 } },
            { text: prompt }
        ] }
    });
    return response.text || "";
};

export const getSuggestionsForZoomPrompt = async (fullImage: {base64: string, mimeType: string}, croppedImage: {base64: string, mimeType: string}, language: string) => {
    const ai = getAiClient();
    const prompt = `Suggest 3 short creative additions for this zoomed area. Return JSON array of strings. Language: ${language}.`;
    const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: { parts: [
            { inlineData: { mimeType: fullImage.mimeType, data: fullImage.base64 } },
            { inlineData: { mimeType: croppedImage.mimeType, data: croppedImage.base64 } },
            { text: prompt }
        ] },
        config: { responseMimeType: "application/json" }
    });
    return JSON.parse(response.text || "[]");
};

export const generateVirtualTourSuggestion = async (image: {base64: string, mimeType: string}, command: string, style: string, language: string) => {
    const ai = getAiClient();
    const prompt = `Given the image and command "${command}", describe the next frame in the virtual tour. Style: ${style}. Language: ${language}.`;
    const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: { parts: [{ inlineData: { mimeType: image.mimeType, data: image.base64 } }, { text: prompt }] }
    });
    return response.text || "";
};

export const prepareGoogleMapPrompt = async (image: {base64: string, mimeType: string}, prompt: string, language: string) => {
     const ai = getAiClient();
     const checkPrompt = `Is this a Google Maps screenshot or satellite view? If yes, create a prompt to render it realistically based on user request: "${prompt}". If no, return EMPTY. Language: ${language}.`;
     const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: { parts: [{ inlineData: { mimeType: image.mimeType, data: image.base64 } }, { text: checkPrompt }] }
    });
    return response.text?.trim() === "EMPTY" ? null : response.text;
};

export const expandPrompt = async (prompt: string, image: {base64: string, mimeType: string} | null, language: string) => {
    const ai = getAiClient();
    const parts: any[] = [];
    if (image) parts.push({ inlineData: { mimeType: image.mimeType, data: image.base64 } });
    parts.push({ text: `Expand this architectural prompt with more details: "${prompt}". Language: ${language}.` });
    const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: { parts }
    });
    return response.text || prompt;
};

export const shortenPrompt = async (prompt: string, language: string) => {
    const ai = getAiClient();
    const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: `Shorten this prompt while keeping key architectural elements: "${prompt}". Language: ${language}.`
    });
    return response.text || prompt;
};

export const suggestCreativePrompt = async (prompt: string, image: {base64: string, mimeType: string}, type: string, language: string) => {
    const ai = getAiClient();
    const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: { parts: [
            { inlineData: { mimeType: image.mimeType, data: image.base64 } },
            { text: `Suggest a ${type} variation of this prompt: "${prompt}" based on the image. Language: ${language}.` }
        ] }
    });
    return response.text || prompt;
};

export const suggestCameraSettings = async (prompt: string, image: {base64: string, mimeType: string} | null, language: string) => {
    const ai = getAiClient();
    const parts: any[] = [];
    if (image) parts.push({ inlineData: { mimeType: image.mimeType, data: image.base64 } });
    parts.push({ text: `Suggest 3 camera settings/angles for this scene: "${prompt}". Return JSON array of strings. Language: ${language}.` });
    const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: { parts },
        config: { responseMimeType: "application/json" }
    });
    return JSON.parse(response.text || "[]");
};

export const optimizeVideoPrompt = async (prompt: string, image: {base64: string, mimeType: string}, language: string) => {
    const ai = getAiClient();
    const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: { parts: [
            { inlineData: { mimeType: image.mimeType, data: image.base64 } },
            { text: `Optimize this prompt for video generation (Veo model): "${prompt}". Focus on movement and camera. Language: ${language}.` }
        ] }
    });
    return response.text || prompt;
};

// --- Image Generation (Imagen 3/4) ---

export const generateImageFromText = async (prompt: string, aspectRatio: string, numberOfImages: number, model: string) => {
    const ai = getAiClient();
    const response = await ai.models.generateImages({
        model: model, // Dynamically use the model passed (e.g., 'imagen-4.0-generate-001' or 'imagen-4.0-generate-001-ultra')
        prompt,
        config: {
            numberOfImages,
            aspectRatio: aspectRatio as any, 
        }
    });
    
    if (response.generatedImages) {
        return response.generatedImages.map(img => img.image.imageBytes);
    }
    return [];
};

export const generateMoodboardFromImages = async (images: {base64: string, mimeType: string}[], options: string[], description: string) => {
    // Reverting to gemini-2.5-flash-image to avoid 403 Permission Denied errors on Pro model
    const ai = getAiClient();
    const parts: any[] = images.map(img => ({ inlineData: { mimeType: img.mimeType, data: img.base64 } }));
    parts.push({ text: `Create a moodboard based on these images. Focus on: ${options.join(', ')}. Description: ${description}` });
    
    return await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: { parts },
        config: { responseModalities: [Modality.IMAGE] }
    });
};

// --- Image Editing (Gemini Pro Image) ---

export const generateImageWithElements = async (prompt: string, mainImage: {base64: string, mimeType: string}, elements: {base64: string, mimeType: string}[], loraPrompt: string, creativity: number, isInpainting: boolean) => {
    // Reverting to gemini-2.5-flash-image to avoid 403 Permission Denied errors on Pro model
    const ai = getAiClient();
    const parts: any[] = [{ inlineData: { mimeType: mainImage.mimeType, data: mainImage.base64 } }];
    elements.forEach(el => parts.push({ inlineData: { mimeType: el.mimeType, data: el.base64 } }));
    
    let fullPrompt = prompt;
    if (loraPrompt) fullPrompt += `\nStyle Guide: ${loraPrompt}`;
    if (isInpainting) fullPrompt += `\n(Inpainting task active)`;
    fullPrompt += `\nCreativity: ${creativity}/10`;
    
    parts.push({ text: fullPrompt });

    return await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: { parts },
        config: { responseModalities: [Modality.IMAGE] }
    });
};

export const generateImageFromImageAndText = async (prompt: string, imageBase64: string, mimeType: string) => {
    // Reverting to gemini-2.5-flash-image to avoid 403 Permission Denied errors on Pro model
    const ai = getAiClient();
    return await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: { parts: [
            { inlineData: { mimeType, data: imageBase64 } },
            { text: prompt }
        ] },
        config: { responseModalities: [Modality.IMAGE] }
    });
};

export const generatePerspectiveFromFloorplan = async (floorplanB64: string, stylePrompt: string, userPrompt: string, view: string, aspectRatio: string, elements: any[]) => {
    // Reverting to gemini-2.5-flash-image to avoid 403 Permission Denied errors on Pro model
    const ai = getAiClient();
    const parts: any[] = [{ inlineData: { mimeType: 'image/jpeg', data: floorplanB64 } }];
    elements.forEach(el => parts.push({ inlineData: { mimeType: el.mimeType, data: el.base64 } }));
    
    const prompt = `Generate a ${view} perspective render from this floorplan. Style: ${stylePrompt}. User notes: ${userPrompt}. Aspect Ratio: ${aspectRatio}.`;
    parts.push({ text: prompt });

    return await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: { parts },
        config: { responseModalities: [Modality.IMAGE] }
    });
};

export const generateCompositeImage = async (objectB64: string, bgB64: string, position: {x: number, y: number}, language: string) => {
    // Reverting to gemini-2.5-flash-image to avoid 403 Permission Denied errors on Pro model
    const ai = getAiClient();
    const prompt = `Composite the object image into the background image at relative position x:${position.x.toFixed(2)}, y:${position.y.toFixed(2)}. Blend realistically. Language: ${language}`;
    
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: { parts: [
            { inlineData: { mimeType: 'image/jpeg', data: bgB64 } },
            { inlineData: { mimeType: 'image/jpeg', data: objectB64 } },
            { text: prompt }
        ] },
        config: { responseModalities: [Modality.IMAGE] }
    });
    
    const b64 = getBase64FromResponse(response);
    return { finalImageUrl: b64 ? `data:image/jpeg;base64,${b64}` : '' };
};

export const removeImageBackground = async (base64: string, mimeType: string) => {
    // Reverting to gemini-2.5-flash-image to avoid 403 Permission Denied errors on Pro model
    const ai = getAiClient();
    return await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: { parts: [
            { inlineData: { mimeType, data: base64 } },
            { text: "Remove the background from this image, keeping the main subject on a transparent or white background." }
        ] },
        config: { responseModalities: [Modality.IMAGE] }
    });
};

export const generateWithContext = async (mainImage: {base64: string, mimeType: string}, contextImage: {base64: string, mimeType: string}, prompt: string, style: string, adherence: number) => {
    // Reverting to gemini-2.5-flash-image to avoid 403 Permission Denied errors on Pro model
    const ai = getAiClient();
    const parts: any[] = [
        { inlineData: { mimeType: mainImage.mimeType, data: mainImage.base64 } },
        { inlineData: { mimeType: contextImage.mimeType, data: contextImage.base64 } },
        { text: `Render the main building into the context image. Prompt: ${prompt}. Style: ${style}. Structure adherence: ${adherence}/10.` }
    ];
    return await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: { parts },
        config: { responseModalities: [Modality.IMAGE] }
    });
};

export const generateImageFromTextAndImages = async (prompt: string, images: {base64: string, mimeType: string}[]) => {
    // Reverting to gemini-2.5-flash-image to avoid 403 Permission Denied errors on Pro model
    const ai = getAiClient();
    const parts: any[] = images.map(img => ({ inlineData: { mimeType: img.mimeType, data: img.base64 } }));
    parts.push({ text: prompt });
    return await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: { parts },
        config: { responseModalities: [Modality.IMAGE] }
    });
};

// --- Video Generation (Veo) ---

export const startVideoGeneration = async (prompt: string, imageB64: string, mimeType: string, aspectRatio: string) => {
    const ai = getAiClient();
    // Veo 3.1 needs specific model name
    return await ai.models.generateVideos({
        model: 'veo-3.1-fast-generate-preview',
        prompt,
        image: {
            imageBytes: imageB64,
            mimeType: mimeType,
        },
        config: {
            numberOfVideos: 1,
            aspectRatio: aspectRatio as any, // '16:9' or '9:16'
        }
    });
};

export const checkVideoOperationStatus = async (operation: any) => {
     const ai = getAiClient();
     return await ai.operations.getVideosOperation({operation: operation});
};
