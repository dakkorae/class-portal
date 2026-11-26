// 공지 그림: 유료 저장소(Storage) 대신 브라우저에서 작게 줄여 공지 문서에 함께 저장
// - 긴 변 1,024px, 장당 약 200KB 이하가 될 때까지 화질을 낮춤 (Firestore 문서 하나 1MB 제한)
export const MAX_IMAGES = 2;
const MAX_SIDE = 1024;
const TARGET_BYTES = 200 * 1024;

const loadImage = (file: File) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('그림을 읽지 못했어요. 다른 그림으로 해 주세요.'));
    };
    img.src = url;
  });

const bytesOf = (dataUrl: string) => Math.ceil(((dataUrl.length - dataUrl.indexOf(',') - 1) * 3) / 4);

export async function shrinkImage(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('그림 파일만 올릴 수 있어요.');
  const img = await loadImage(file);
  let scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;
  for (let attempt = 0; attempt < 6; attempt++) {
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    for (const q of [0.82, 0.7, 0.58, 0.46]) {
      const url = canvas.toDataURL('image/jpeg', q);
      if (bytesOf(url) <= TARGET_BYTES) return url;
    }
    scale *= 0.8;
  }
  throw new Error('그림이 너무 커요. 더 작은 그림으로 해 주세요.');
}
