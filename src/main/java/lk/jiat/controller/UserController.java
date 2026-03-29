package lk.jiat.controller;

import com.google.cloud.firestore.*;
import lk.jiat.util.FirebaseUtil;

import javax.ws.rs.*;
import javax.ws.rs.core.MediaType;
import javax.ws.rs.core.Response;

import java.util.*;
import java.util.concurrent.ExecutionException;

// UserController — read-only view of all registered app users.
// GET /api/v1/users
@Path("/users")
@Produces(MediaType.APPLICATION_JSON)
public class UserController {

    @GET
    public Response getAllUsers() {
        try {
            Firestore db = FirebaseUtil.getFirestore();
            QuerySnapshot snapshot = db.collection("users").get().get();

            List<Map<String, Object>> users = new ArrayList<>();
            for (QueryDocumentSnapshot doc : snapshot.getDocuments()) {
                Map<String, Object> user = new HashMap<>(doc.getData());
                user.put("firestoreId", doc.getId());
                user.remove("password"); // never send passwords to frontend
                users.add(user);
            }
            return Response.ok(users).build();

        } catch (InterruptedException | ExecutionException e) {
            Map<String, Object> err = new HashMap<>();
            err.put("error", "Failed to load users: " + e.getMessage());
            return Response.serverError().entity(err).build();
        }
    }

    @OPTIONS public Response options() { return Response.ok().build(); }
}