const cloudinary = require('cloudinary').v2;

// Configure Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true
});

// Upload an image and return the URL
const uploadImage = async (imagePath, publicId) => {
    try {
        const result = await cloudinary.uploader.upload(imagePath, {
            public_id: publicId,
            folder: 'players', // Store all player images in a 'players' folder
            format: 'webp', // Convert all images to WebP for better compression
            quality: 'auto', // Automatic quality optimization
            fetch_format: 'auto', // Deliver in the best format for the browser
            crop: 'fill', // Crop and resize to fill the specified dimensions
            width: 400, // Standard width for player images
            height: 400 // Standard height for player images
        });
        return result.secure_url;
    } catch (error) {
        console.error('Error uploading image to Cloudinary:', error);
        throw error;
    }
};

// Update an existing image
const updateImage = async (imagePath, publicId) => {
    try {
        // First, delete the existing image if it exists
        await cloudinary.uploader.destroy(publicId);
        // Then upload the new image
        return await uploadImage(imagePath, publicId);
    } catch (error) {
        console.error('Error updating image in Cloudinary:', error);
        throw error;
    }
};

// Delete an image
const deleteImage = async (publicId) => {
    try {
        await cloudinary.uploader.destroy(publicId);
    } catch (error) {
        console.error('Error deleting image from Cloudinary:', error);
        throw error;
    }
};

module.exports = {
    uploadImage,
    updateImage,
    deleteImage
};
