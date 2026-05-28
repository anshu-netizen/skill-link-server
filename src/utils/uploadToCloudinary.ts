import cloudinary from "../config/cloudinary";

const uploadBufferToCloudinary = async (
  fileBuffer: Buffer,
  folder = "skilllink/providers"
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: "image",
      },
      (error, result) => {
        if (error) {
          return reject(error);
        }

        if (!result?.secure_url) {
          return reject(new Error("Cloudinary upload failed"));
        }

        resolve(result.secure_url);
      }
    );

    stream.end(fileBuffer);
  });
};

export default uploadBufferToCloudinary;