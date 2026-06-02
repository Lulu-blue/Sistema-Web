/**
 * Módulo de Storage - Cloudinary
 * Substitui todas as chamadas do Supabase Storage por Cloudinary
 * 
 * CONFIGURAÇÃO:
 * Substitua os valores abaixo pelos seus dados do Cloudinary:
 */
const CLOUDINARY_CLOUD_NAME = 'dsctsogdy';       // ex: 'meu-projeto'
const CLOUDINARY_UPLOAD_PRESET = 'semac_unsigned';     // nome do upload preset que você vai criar

/**
 * Faz upload de um arquivo para o Cloudinary (unsigned upload)
 * @param {File} file - Arquivo do input file
 * @param {string} folder - Pasta no Cloudinary (ex: 'semac/tarefa_anexos/123')
 * @param {string} publicId - ID público opcional (ex: '456_arquivo')
 * @returns {Promise<{url: string, publicId: string}>}
 */
async function cloudinaryUpload(file, folder, publicId) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
    if (folder) formData.append('folder', folder);
    if (publicId) formData.append('public_id', publicId);

    const response = await fetch(
        'https://api.cloudinary.com/v1_1/' + CLOUDINARY_CLOUD_NAME + '/auto/upload',
        { method: 'POST', body: formData }
    );

    if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error?.message || 'Erro no upload para Cloudinary: ' + response.status);
    }

    const data = await response.json();
    return { url: data.secure_url, publicId: data.public_id };
}

/**
 * Faz upload usando um path completo no formato antigo do Supabase
 * Converte automaticamente para folder + publicId do Cloudinary
 * @param {File} file - Arquivo
 * @param {string} path - Path completo (ex: 'tarefa_anexos/123/456_arquivo.jpg')
 * @returns {Promise<{url: string, publicId: string}>}
 */
async function cloudinaryUploadComPath(file, path) {
    var partes = path.split('/');
    var nomeArquivo = partes.pop();
    var publicId = nomeArquivo.replace(/\.[^.]+$/, '');
    var folder = 'semac/' + partes.join('/');
    return await cloudinaryUpload(file, folder, publicId);
}

/**
 * Comprime uma imagem antes do upload (usando canvas)
 * @param {File} file - Arquivo de imagem
 * @param {Object} options - Opções de compressão
 * @returns {Promise<Blob>}
 */
async function comprimirImagem(file, options) {
    options = options || {};
    const maxWidth = options.maxWidth || 1920;
    const maxHeight = options.maxHeight || 1920;
    const quality = options.quality || 0.8;
    const maxSizeMB = options.maxSizeMB || 1;

    if (!file.type.startsWith('image/')) return file;
    if (file.size <= maxSizeMB * 1024 * 1024 && !options.force) return file;

    return new Promise((resolve, reject) => {
        const img = new Image();
        const url = URL.createObjectURL(file);

        img.onload = function () {
            URL.revokeObjectURL(url);
            let { width, height } = img;

            if (width > maxWidth || height > maxHeight) {
                const ratio = Math.min(maxWidth / width, maxHeight / height);
                width = Math.round(width * ratio);
                height = Math.round(height * ratio);
            }

            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);

            const outputType = options.type || (file.type === 'image/png' ? 'image/png' : 'image/jpeg');

            canvas.toBlob(function (blob) {
                if (!blob) { reject(new Error('Falha ao comprimir imagem')); return; }
                if (blob.size > maxSizeMB * 1024 * 1024 && outputType === 'image/jpeg') {
                    canvas.toBlob(function (blob2) {
                        if (!blob2) reject(new Error('Falha ao comprimir imagem'));
                        else resolve(blob2);
                    }, outputType, quality * 0.7);
                } else {
                    resolve(blob);
                }
            }, outputType, quality);
        };

        img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('Erro ao carregar imagem')); };
        img.src = url;
    });
}

// Expor funções globalmente
window.cloudinaryUpload = cloudinaryUpload;
window.comprimirImagem = comprimirImagem;
