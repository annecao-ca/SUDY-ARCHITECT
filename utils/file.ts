
export const base64ToFile = (base64: string, filename: string, mimeType: string): File => {
  const byteCharacters = atob(base64);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  return new File([byteArray], filename, { type: mimeType });
};

export const fileToDataURL = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (error) => reject(error);
  });
};

export const fileToBase64 = (file: File): Promise<{ base64: string, mimeType: string }> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1];
      resolve({ base64, mimeType: file.type });
    };
    reader.onerror = (error) => reject(error);
  });
};

export const dataURLtoBase64 = (dataUrl: string): { base64: string, mimeType: string } => {
    const parts = dataUrl.split(',');
    const mimeType = parts[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
    const base64 = parts[1];
    return { base64, mimeType };
}

export const extendImageToAspectRatio = (file: File, targetAspectRatio: number): Promise<{ base64: string, mimeType: string }> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => {
            const img = new Image();
            img.onload = () => {
                const originalAspectRatio = img.naturalWidth / img.naturalHeight;
                const RATIO_THRESHOLD = 0.05; // 5% tolerance

                // If aspect ratios are very similar, just return original image's base64
                if (Math.abs(originalAspectRatio - targetAspectRatio) < RATIO_THRESHOLD) {
                    resolve(fileToBase64(file));
                    return;
                }

                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    reject(new Error("Could not get canvas context"));
                    return;
                }

                let newWidth, newHeight;
                if (targetAspectRatio > originalAspectRatio) { // Target is wider
                    newHeight = img.naturalHeight;
                    newWidth = newHeight * targetAspectRatio;
                } else { // Target is taller
                    newWidth = img.naturalWidth;
                    newHeight = newWidth / targetAspectRatio;
                }
                
                canvas.width = newWidth;
                canvas.height = newHeight;
                
                ctx.fillStyle = 'white'; // Fill with white background
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                
                const dx = (newWidth - img.naturalWidth) / 2;
                const dy = (newHeight - img.naturalHeight) / 2;

                ctx.drawImage(img, dx, dy);
                
                const dataUrl = canvas.toDataURL('image/jpeg');
                resolve(dataURLtoBase64(dataUrl));
            };
            img.onerror = reject;
            img.src = reader.result as string;
        };
        reader.onerror = reject;
    });
};

export const getImageDimensions = (dataUrl: string): Promise<{ width: number, height: number }> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
        img.onerror = reject;
        img.src = dataUrl;
    });
};

export const resizeImage = (dataUrl: string, dimension: number): Promise<string> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = dimension;
            canvas.height = dimension;
            const ctx = canvas.getContext('2d');
            if (!ctx) return reject('Could not get canvas context');

            ctx.fillStyle = 'black';
            ctx.fillRect(0, 0, dimension, dimension);

            const hRatio = dimension / img.width;
            const vRatio = dimension / img.height;
            const ratio = Math.min(hRatio, vRatio);
            const centerShift_x = (dimension - img.width * ratio) / 2;
            const centerShift_y = (dimension - img.height * ratio) / 2;
            
            ctx.drawImage(img, 0, 0, img.width, img.height,
                centerShift_x, centerShift_y, img.width * ratio, img.height * ratio);
            
            resolve(canvas.toDataURL('image/jpeg'));
        };
        img.onerror = reject;
        img.src = dataUrl;
    });
};

export const cropToOriginalAspectRatio = (dataUrl: string, originalWidth: number, originalHeight: number): Promise<string> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            const originalAspectRatio = originalWidth / originalHeight;
            let sx, sy, sWidth, sHeight;

            if (originalAspectRatio > 1) { // Landscape
                sWidth = img.width;
                sHeight = img.width / originalAspectRatio;
                sx = 0;
                sy = (img.height - sHeight) / 2;
            } else { // Portrait or square
                sHeight = img.height;
                sWidth = img.height * originalAspectRatio;
                sy = 0;
                sx = (img.width - sWidth) / 2;
            }
            
            const canvas = document.createElement('canvas');
            canvas.width = sWidth;
            canvas.height = sHeight;
            const ctx = canvas.getContext('2d');
            if (!ctx) return reject('Could not get canvas context');
            
            ctx.drawImage(img, sx, sy, sWidth, sHeight, 0, 0, sWidth, sHeight);
            
            resolve(canvas.toDataURL('image/jpeg'));
        };
        img.onerror = reject;
        img.src = dataUrl;
    });
};