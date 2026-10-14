import { Readable } from 'stream';
import cloudinary from '../../config/cloudinary.js';
import { getUploadTransformation } from './uploadPresets.js';

/**
 * Upload a buffer to Cloudinary with an optional quality preset.
 * The transformation is applied to the *stored* asset — Cloudinary
 * runs the resize/compress before persisting, so cloud space stays
 * small. Pass `preset: 'raw'` to preserve the untouched original.
 */
export const uploadToCloudinary = (buffer, folder = 'the_print_labs', preset = 'product') => {
  return new Promise((resolve, reject) => {
    const transformation = getUploadTransformation(preset);

    const options = { folder };
    if (transformation) options.transformation = transformation;

    const uploadStream = cloudinary.uploader.upload_stream(
      options,
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      }
    );
    Readable.from(buffer).pipe(uploadStream);
  });
};

export const deleteFromCloudinary = async (publicId) => {
  return await cloudinary.uploader.destroy(publicId);
};
