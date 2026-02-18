'use client'

import { useState, useRef } from 'react'
import Image from 'next/image'
import { Upload, X, FileText, Check } from 'lucide-react'

interface UploadedFile {
    id: string
    name: string
    type: 'image' | 'document'
    preview?: string
    file: File
}

interface FileUploadProps {
    onFilesChange?: (files: UploadedFile[]) => void
    maxFiles?: number
    acceptImages?: boolean
    acceptDocuments?: boolean
}

export default function FileUpload({
    onFilesChange,
    maxFiles = 5,
    acceptImages = true,
    acceptDocuments = true
}: FileUploadProps) {
    const [files, setFiles] = useState<UploadedFile[]>([])
    const [isDragging, setIsDragging] = useState(false)
    const inputRef = useRef<HTMLInputElement>(null)

    const acceptTypes = [
        ...(acceptImages ? ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] : []),
        ...(acceptDocuments ? ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'] : [])
    ]

    const handleFiles = (fileList: FileList) => {
        const newFiles: UploadedFile[] = []

        Array.from(fileList).forEach((file) => {
            if (files.length + newFiles.length >= maxFiles) return
            if (!acceptTypes.includes(file.type)) return

            const isImage = file.type.startsWith('image/')
            const uploadedFile: UploadedFile = {
                id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                name: file.name,
                type: isImage ? 'image' : 'document',
                file
            }

            if (isImage) {
                uploadedFile.preview = URL.createObjectURL(file)
            }

            newFiles.push(uploadedFile)
        })

        const updatedFiles = [...files, ...newFiles]
        setFiles(updatedFiles)
        onFilesChange?.(updatedFiles)
    }

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault()
        setIsDragging(false)
        handleFiles(e.dataTransfer.files)
    }

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault()
        setIsDragging(true)
    }

    const handleDragLeave = () => {
        setIsDragging(false)
    }

    const removeFile = (id: string) => {
        const updatedFiles = files.filter(f => f.id !== id)
        setFiles(updatedFiles)
        onFilesChange?.(updatedFiles)
    }

    const openFileDialog = () => {
        inputRef.current?.click()
    }

    return (
        <div className="space-y-4">
            {/* Drop Zone */}
            <div
                onClick={openFileDialog}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                className={`
                    border-2 border-dashed rounded-2xl p-4 sm:p-6 text-center cursor-pointer
                    transition-all duration-200
                    ${isDragging
                        ? 'border-meta-orange bg-meta-orange/10'
                        : 'border-white/20 hover:border-meta-orange/50 bg-deep-dark-200/40'
                    }
                `}
            >
                <input
                    ref={inputRef}
                    type="file"
                    multiple
                    accept={acceptTypes.join(',')}
                    onChange={(e) => e.target.files && handleFiles(e.target.files)}
                    className="hidden"
                />

                <div className="flex flex-col items-center gap-2 sm:gap-3">
                    <div className={`
                        w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center
                        ${isDragging ? 'bg-meta-orange/20' : 'bg-deep-dark-300'}
                    `}>
                        <Upload className={`w-5 h-5 sm:w-6 sm:h-6 ${isDragging ? 'text-meta-orange' : 'text-gray-400'}`} />
                    </div>
                    <div>
                        <p className="text-xs sm:text-sm text-white font-medium px-2">
                            Перетащите файлы или нажмите для выбора
                        </p>
                        <p className="text-[10px] sm:text-xs text-gray-500 mt-1">
                            {acceptImages && 'JPG, PNG, WebP'}
                            {acceptImages && acceptDocuments && ' • '}
                            {acceptDocuments && 'PDF, DOC'}
                            {` • до ${maxFiles} файлов`}
                        </p>
                    </div>
                </div>
            </div>

            {/* Uploaded Files Preview */}
            {files.length > 0 && (
                <div className="space-y-1.5 sm:space-y-2">
                    <p className="text-[10px] sm:text-xs text-gray-500 ml-1 uppercase tracking-wider font-bold">
                        Загружено ({files.length}/{maxFiles})
                    </p>
                    <div className="grid grid-cols-3 sm:grid-cols-2 gap-2 sm:gap-3">
                        {files.map((file) => (
                            <div
                                key={file.id}
                                className="relative group rounded-xl overflow-hidden bg-deep-dark-200/60 border border-white/10 aspect-[4/5] sm:aspect-square"
                            >
                                {file.type === 'image' && file.preview ? (
                                    <div className="relative w-full h-full bg-black/20">
                                        <Image
                                            src={file.preview}
                                            alt={file.name}
                                            fill
                                            className="object-cover"
                                            unoptimized
                                        />
                                    </div>
                                ) : (
                                    <div className="w-full h-full flex flex-col items-center justify-center p-2">
                                        <FileText className="w-5 h-5 sm:w-8 sm:h-8 text-gray-400 mb-1" />
                                        <p className="text-[8px] sm:text-xs text-gray-400 text-center line-clamp-1 px-1">
                                            {file.name}
                                        </p>
                                    </div>
                                )}

                                {/* Remove Button */}
                                <button
                                    onClick={() => removeFile(file.id)}
                                    className="absolute top-1 right-1 w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-red-500/90 
                                               flex items-center justify-center opacity-100 sm:opacity-0 sm:group-hover:opacity-100
                                               transition-opacity duration-200 shadow-md z-10"
                                >
                                    <X className="w-3 h-3 text-white" />
                                </button>

                                {/* Success Indicator */}
                                <div className="absolute bottom-1 left-1 w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-green-500 
                                                flex items-center justify-center shadow-md">
                                    <Check className="w-2.5 h-2.5 text-white" />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}
