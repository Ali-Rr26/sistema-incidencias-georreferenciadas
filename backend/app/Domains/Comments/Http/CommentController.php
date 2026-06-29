<?php

declare(strict_types=1);

namespace App\Domains\Comments\Http;

use App\Domains\Comments\Http\Requests\StoreCommentRequest;
use App\Domains\Comments\Http\Requests\UpdateCommentRequest;
use App\Domains\Comments\Http\Resources\CommentCollection;
use App\Domains\Comments\Http\Resources\CommentResource;
use App\Domains\Comments\Models\Comment;
use App\Domains\Comments\Repositories\CommentRepository;
use App\Domains\Incidents\Models\Incident;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;

class CommentController extends Controller
{
    public function __construct(
        private readonly CommentRepository $commentRepository,
    ) {}

    public function index(Request $request, Incident $incident): CommentCollection
    {
        $comments = $this->commentRepository->paginate(
            filters: ['incident_id' => $incident->id],
            perPage: (int) $request->integer('per_page', 20),
        );

        return new CommentCollection($comments);
    }

    public function store(StoreCommentRequest $request, Incident $incident): JsonResponse
    {
        $comment = $this->commentRepository->create([
            'incident_id' => $incident->id,
            'user_id' => auth()->id(),
            'message' => $request->input('message'),
        ]);

        $comment->load('user');

        return (new CommentResource($comment))
            ->response()
            ->setStatusCode(201);
    }

    public function show(Comment $comment): CommentResource
    {
        $comment->load('user');

        return new CommentResource($comment);
    }

    public function update(UpdateCommentRequest $request, Comment $comment): CommentResource
    {
        $this->commentRepository->update($comment->id, [
            'message' => $request->input('message'),
        ]);

        $comment = $comment->fresh();
        $comment->load('user');

        return new CommentResource($comment);
    }

    public function destroy(Comment $comment): JsonResponse
    {
        $this->commentRepository->delete($comment->id);

        return response()->json(null, 204);
    }
}
