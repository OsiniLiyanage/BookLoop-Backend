package lk.jiat.controller;

import com.google.api.core.ApiFuture;
import com.google.cloud.firestore.*;
import lk.jiat.util.FirebaseUtil;

// IMPORTANT: Use javax.ws.rs.* (Jersey 2.x), NOT jakarta.ws.rs.* (Jersey 3.x)
// Jersey 2.x + Tomcat 10.1 + Java 11 = the correct combination for our setup
import javax.ws.rs.*;
import javax.ws.rs.core.MediaType;
import javax.ws.rs.core.Response;

import java.util.*;
import java.util.concurrent.ExecutionException;

/*
 * BookController — REST API for managing books.
 *
 * All data saves to Firestore "products" collection —
 * the SAME collection your Android app reads from.
 * So any book you add here appears instantly in the Android app.
 *
 * Endpoints:
 *   GET    /api/v1/books               → get all books
 *   POST   /api/v1/books               → add a new book
 *   PUT    /api/v1/books/{id}          → edit a book
 *   DELETE /api/v1/books/{id}          → delete a book
 *   PATCH  /api/v1/books/{id}/status   → toggle available/unavailable
 */
@Path("/books")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class BookController {

    // GET /api/v1/books
    @GET
    public Response getAllBooks() {
        try {
            Firestore db = FirebaseUtil.getFirestore();
            QuerySnapshot snapshot = db.collection("products").get().get();

            List<Map<String, Object>> books = new ArrayList<>();
            for (QueryDocumentSnapshot doc : snapshot.getDocuments()) {
                Map<String, Object> book = new HashMap<>(doc.getData());
                book.put("firestoreId", doc.getId()); // needed for edit/delete
                books.add(book);
            }
            return Response.ok(books).build();

        } catch (InterruptedException | ExecutionException e) {
            Map<String, Object> err = new HashMap<>();
            err.put("error", "Failed to load books: " + e.getMessage());
            return Response.serverError().entity(err).build();
        }
    }

    // POST /api/v1/books — add new book
    @POST
    public Response addBook(Map<String, Object> bookData) {
        try {
            Firestore db = FirebaseUtil.getFirestore();

            // Generate unique productId (same format Android app expects)
            String productId = "pid_" + System.currentTimeMillis();
            bookData.put("productId", productId);

            if (!bookData.containsKey("status"))  bookData.put("status", true);
            if (!bookData.containsKey("rating"))  bookData.put("rating", 0.0);

            // createdAt timestamp — used by Android HomeFragment to show newest books first
            // in the "New Arrivals" section. Set only on creation, never overwritten on edit.
            bookData.put("createdAt", com.google.cloud.Timestamp.now());

            DocumentReference docRef = db.collection("products").add(bookData).get();

            Map<String, Object> result = new HashMap<>();
            result.put("message", "Book added successfully");
            result.put("productId", productId);
            result.put("firestoreId", docRef.getId());
            return Response.status(Response.Status.CREATED).entity(result).build();

        } catch (InterruptedException | ExecutionException e) {
            Map<String, Object> err = new HashMap<>();
            err.put("error", "Failed to add book: " + e.getMessage());
            return Response.serverError().entity(err).build();
        }
    }

    // PUT /api/v1/books/{firestoreId} — edit existing book
    @PUT
    @Path("/{firestoreId}")
    public Response updateBook(@PathParam("firestoreId") String firestoreId,
                               Map<String, Object> bookData) {
        try {
            Firestore db = FirebaseUtil.getFirestore();
            bookData.remove("firestoreId"); // don't overwrite internal ID

            db.collection("products")
                    .document(firestoreId)
                    .set(bookData, SetOptions.merge()) // merge = keep fields not in body
                    .get();

            Map<String, Object> result = new HashMap<>();
            result.put("message", "Book updated successfully");
            return Response.ok(result).build();

        } catch (InterruptedException | ExecutionException e) {
            Map<String, Object> err = new HashMap<>();
            err.put("error", "Failed to update book: " + e.getMessage());
            return Response.serverError().entity(err).build();
        }
    }

    // DELETE /api/v1/books/{firestoreId}
    @DELETE
    @Path("/{firestoreId}")
    public Response deleteBook(@PathParam("firestoreId") String firestoreId) {
        try {
            Firestore db = FirebaseUtil.getFirestore();
            db.collection("products").document(firestoreId).delete().get();

            Map<String, Object> result = new HashMap<>();
            result.put("message", "Book deleted successfully");
            return Response.ok(result).build();

        } catch (InterruptedException | ExecutionException e) {
            Map<String, Object> err = new HashMap<>();
            err.put("error", "Failed to delete book: " + e.getMessage());
            return Response.serverError().entity(err).build();
        }
    }

    // PATCH /api/v1/books/{firestoreId}/status — toggle available/unavailable
    @PATCH
    @Path("/{firestoreId}/status")
    public Response toggleStatus(@PathParam("firestoreId") String firestoreId,
                                 Map<String, Object> body) {
        try {
            Firestore db = FirebaseUtil.getFirestore();

            Boolean newStatus = (Boolean) body.get("status");
            if (newStatus == null) {
                Map<String, Object> err = new HashMap<>();
                err.put("error", "status field required (true/false)");
                return Response.status(Response.Status.BAD_REQUEST).entity(err).build();
            }

            db.collection("products")
                    .document(firestoreId)
                    .update("status", newStatus)
                    .get();

            Map<String, Object> result = new HashMap<>();
            result.put("message", "Status updated");
            result.put("status", newStatus);
            return Response.ok(result).build();

        } catch (InterruptedException | ExecutionException e) {
            Map<String, Object> err = new HashMap<>();
            err.put("error", "Failed to update status: " + e.getMessage());
            return Response.serverError().entity(err).build();
        }
    }

    // OPTIONS handlers for CORS preflight
    @OPTIONS public Response options() { return Response.ok().build(); }
    @OPTIONS @Path("/{id}") public Response optionsId() { return Response.ok().build(); }
    @OPTIONS @Path("/{id}/status") public Response optionsStatus() { return Response.ok().build(); }
}