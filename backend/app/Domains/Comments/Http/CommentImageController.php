<?php

declare(strict_types=1);

namespace App\Domains\Comments\Http;

use App\Domains\Comments\Http\Requests\StoreCommentImageRequest;
use App\Domains\Comments\Http\Resources\CommentImageResource;
use App\Domains\Comments\Models\Comment;
use App\Domains\Comments\Models\CommentImage;
use App\Domains\Comments\Services\ImageProcessingService;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;

class CommentImageController
{
    public function __construct(
        private readonly ImageProcessingService $imageService,
    ) {}

    public function store(StoreCommentImageRequest $request, Comment $comment): JsonResponse
    {
        Gate::authorize('update', $comment);

        $images = collect($request->file('images'))->map(function ($file) use ($comment) {
            $path = $this->imageService->processUploadedImage($file, $comment->id);

            return CommentImage::create([
                'comment_id' => $comment->id,
                'url' => $path,
                'caption' => null,
                'sort_order' => 0,
            ]);
        });

        return CommentImageResource::collection($images)
            ->response()
            ->setStatusCode(201);
    }

    public function destroy(Comment $comment, CommentImage $image): JsonResponse
    {
        Gate::authorize('update', $comment);

        if ($image->comment_id !== $comment->id) {
            abort(404, 'Imagen no encontrada.');
        }

        try {
            Storage::disk($this->storageDisk())->delete($image->url);
        } catch (\Throwable $e) {
            Log::warning('Failed to delete image file from S3', [
                'path' => $image->url,
                'error' => $e->getMessage(),
            ]);
        }

        $image->delete();

        return response()->json(null, 204);
    }

    private function storageDisk(): string
    {
        return env('FILESYSTEM_DISK', 's3');
    }
}
