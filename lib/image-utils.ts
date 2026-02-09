export async function downloadImageAsJpg(imageUrl: string, filename: string) {
    try {
        const img = new Image()
        img.crossOrigin = "anonymous"
        img.src = imageUrl

        await new Promise((resolve, reject) => {
            img.onload = resolve
            img.onerror = () => reject(new Error('Ошибка загрузки изображения'))
        })

        const canvas = document.createElement('canvas')
        canvas.width = img.width
        canvas.height = img.height
        const ctx = canvas.getContext('2d')
        if (!ctx) throw new Error('Не удалось создать холст')

        // Fill white background for JPG
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        ctx.drawImage(img, 0, 0)

        return new Promise<void>((resolve, reject) => {
            canvas.toBlob((blob) => {
                if (!blob) {
                    reject(new Error('Ошибка конвертации'))
                    return
                }
                const url = URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url
                a.download = filename.endsWith('.jpg') ? filename : `${filename}.jpg`
                document.body.appendChild(a)
                a.click()
                document.body.removeChild(a)
                URL.revokeObjectURL(url)
                resolve()
            }, 'image/jpeg', 0.92)
        })
    } catch (error) {
        console.error('[downloadImageAsJpg] Error:', error)
        throw error
    }
}
