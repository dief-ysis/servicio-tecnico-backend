const cloudinary = require('cloudinary').v2
const multer = require('multer')

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

const storage = multer.memoryStorage()

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg']
    if (allowed.includes(file.mimetype)) {
      cb(null, true)
    } else {
      cb(new Error('Formato no permitido. Usa JPG, PNG o WebP'))
    }
  }
})

const subirACloudinary = (buffer, mimetype) => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: 'servicio-tecnico',
        transformation: [{ width: 1200, height: 900, crop: 'limit', quality: 'auto' }]
      },
      (error, result) => {
        if (error) reject(error)
        else resolve(result)
      }
    )
    stream.end(buffer)
  })
}

module.exports = { upload, subirACloudinary }