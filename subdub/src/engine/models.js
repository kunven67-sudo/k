// Every model SUBDUB downloads, where it comes from, and roughly how big it is (MB).
const HF = 'https://huggingface.co';
export const MODELS = {
  vad: { url: `${HF}/onnx-community/silero-vad/resolve/main/onnx/model.onnx`, mb: 2 },
  gender: { url: `${HF}/Alice-Sabrina-Ivy/voice-gender-classifier-onnx-q8-v2/resolve/main/onnx/model_quantized.onnx`, mb: 16 },
  speaker: { id: 'onnx-community/wespeaker-voxceleb-resnet34-LM', dtype: 'int8', mb: 7 },
  // voice cutters: Spleeter (fast, default) and MDX-Net Kim Vocal 2 (extra clean, needs a strong graphics card)
  sep: {
    fast: { vocals: `${HF}/csukuangfj/sherpa-onnx-spleeter-2stems/resolve/main/vocals.onnx`, music: `${HF}/csukuangfj/sherpa-onnx-spleeter-2stems/resolve/main/accompaniment.onnx`, mb: 79 },
    best: { url: `${HF}/seanghay/uvr_models/resolve/main/Kim_Vocal_2.onnx`, mb: 67 },
  },
  ocrDet: { url: `${HF}/PaddlePaddle/PP-OCRv5_mobile_det_onnx/resolve/main/inference.onnx`, mb: 5 },
  // recognizers per writing system (the main one reads Chinese, Japanese and plain English letters)
  ocrRec: {
    main: { repo: 'PaddlePaddle/PP-OCRv5_mobile_rec_onnx', mb: 17 },
    latin: { repo: 'PaddlePaddle/latin_PP-OCRv5_mobile_rec_onnx', mb: 8 },
    korean: { repo: 'PaddlePaddle/korean_PP-OCRv5_mobile_rec_onnx', mb: 13 },
    eslav: { repo: 'PaddlePaddle/eslav_PP-OCRv5_mobile_rec_onnx', mb: 8 },
    arabic: { repo: 'PaddlePaddle/arabic_PP-OCRv5_mobile_rec_onnx', mb: 8 },
    th: { repo: 'PaddlePaddle/th_PP-OCRv5_mobile_rec_onnx', mb: 8 },
  },
  whisper: {
    // graphics card: full-precision encoder (q4 encoders lose accuracy on cards) + 4-bit decoder
    fast: { id: 'onnx-community/whisper-base', gpu: { encoder_model: 'fp32', decoder_model_merged: 'q4' }, cpu: 'q8', mb: { gpu: 150, cpu: 77 } },
    good: { id: 'onnx-community/whisper-small', gpu: { encoder_model: 'fp32', decoder_model_merged: 'q4' }, cpu: 'q8', mb: { gpu: 470, cpu: 249 } },
    best: { id: 'onnx-community/whisper-large-v3-turbo', gpu: { encoder_model: 'fp16', decoder_model_merged: 'q4' }, cpu: 'q8', mb: { gpu: 1400, cpu: 1085 } },
  },
  tts: { id: 'onnx-community/Kokoro-82M-v1.0-ONNX', gpu: 'fp32', cpu: 'q8', mb: { gpu: 326, cpu: 92 } },
  // backup translators when the browser has no built-in Translator
  mt: {
    ja: 'Xenova/opus-mt-ja-en', ko: 'Xenova/opus-mt-ko-en', zh: 'Xenova/opus-mt-zh-en', es: 'Xenova/opus-mt-es-en',
    pt: 'Xenova/opus-mt-ROMANCE-en', fr: 'Xenova/opus-mt-fr-en', it: 'Xenova/opus-mt-it-en', de: 'Xenova/opus-mt-de-en',
    ru: 'Xenova/opus-mt-ru-en', ar: 'Xenova/opus-mt-ar-en', vi: 'Xenova/opus-mt-vi-en', id: 'Xenova/opus-mt-id-en',
    th: 'Xenova/opus-mt-th-en', tl: 'Xenova/opus-mt-tl-en', hi: 'Xenova/opus-mt-hi-en', '*': 'Xenova/opus-mt-mul-en',
  },
};
export const ocrRecUrl = (k) => `${HF}/${MODELS.ocrRec[k].repo}/resolve/main/inference.onnx`;
export const ocrDictUrl = (k) => `${HF}/${MODELS.ocrRec[k].repo}/resolve/main/inference.yml`;
