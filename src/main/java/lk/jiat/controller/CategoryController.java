package lk.jiat.controller;

import com.google.cloud.firestore.*;
import lk.jiat.util.FirebaseUtil;

import javax.ws.rs.*;
import javax.ws.rs.core.MediaType;
import javax.ws.rs.core.Response;

import java.util.*;
import java.util.concurrent.ExecutionException;

/*
 * CategoryController — REST API for managing book categories.
 * Writes to Firestore "categories" collection — same one Android app reads.
 *
 * Endpoints:
 *   GET    /api/v1/categories         → all categories
 *   POST   /api/v1/categories         → add category
 *   PUT    /api/v1/categories/{id}    → edit category
 *   DELETE /api/v1/categories/{id}    → delete category
 */
@Path("/categories")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class CategoryController {

    @GET
    public Response getAllCategories() {
        try {
            Firestore db = FirebaseUtil.getFirestore();
            QuerySnapshot snapshot = db.collection("categories").get().get();

            List<Map<String, Object>> categories = new ArrayList<>();
            for (QueryDocumentSnapshot doc : snapshot.getDocuments()) {
                Map<String, Object> cat = new HashMap<>(doc.getData());
                cat.put("firestoreId", doc.getId());
                categories.add(cat);
            }
            return Response.ok(categories).build();

        } catch (InterruptedException | ExecutionException e) {
            Map<String, Object> err = new HashMap<>();
            err.put("error", "Failed to load categories: " + e.getMessage());
            return Response.serverError().entity(err).build();
        }
    }

    @POST
    public Response addCategory(Map<String, Object> categoryData) {
        try {
            Firestore db = FirebaseUtil.getFirestore();
            String categoryId = "cat_" + System.currentTimeMillis();
            categoryData.put("categoryId", categoryId);

            DocumentReference docRef = db.collection("categories").add(categoryData).get();

            Map<String, Object> result = new HashMap<>();
            result.put("message", "Category added");
            result.put("categoryId", categoryId);
            result.put("firestoreId", docRef.getId());
            return Response.status(Response.Status.CREATED).entity(result).build();

        } catch (InterruptedException | ExecutionException e) {
            Map<String, Object> err = new HashMap<>();
            err.put("error", "Failed to add category: " + e.getMessage());
            return Response.serverError().entity(err).build();
        }
    }

    @PUT
    @Path("/{firestoreId}")
    public Response updateCategory(@PathParam("firestoreId") String firestoreId,
                                   Map<String, Object> categoryData) {
        try {
            Firestore db = FirebaseUtil.getFirestore();
            categoryData.remove("firestoreId");
            db.collection("categories").document(firestoreId)
                    .set(categoryData, SetOptions.merge()).get();

            Map<String, Object> result = new HashMap<>();
            result.put("message", "Category updated");
            return Response.ok(result).build();

        } catch (InterruptedException | ExecutionException e) {
            Map<String, Object> err = new HashMap<>();
            err.put("error", "Failed to update category: " + e.getMessage());
            return Response.serverError().entity(err).build();
        }
    }

    @DELETE
    @Path("/{firestoreId}")
    public Response deleteCategory(@PathParam("firestoreId") String firestoreId) {
        try {
            Firestore db = FirebaseUtil.getFirestore();
            db.collection("categories").document(firestoreId).delete().get();

            Map<String, Object> result = new HashMap<>();
            result.put("message", "Category deleted");
            return Response.ok(result).build();

        } catch (InterruptedException | ExecutionException e) {
            Map<String, Object> err = new HashMap<>();
            err.put("error", "Failed to delete category: " + e.getMessage());
            return Response.serverError().entity(err).build();
        }
    }

    @OPTIONS public Response options() { return Response.ok().build(); }
    @OPTIONS @Path("/{id}") public Response optionsId() { return Response.ok().build(); }
}