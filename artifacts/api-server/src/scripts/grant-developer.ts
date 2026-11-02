import { clerkClient } from "@clerk/express";
const email = process.argv[2]?.trim();
if (process.env.NODE_ENV !== "development" ||
    !(process.env.CLERK_PUBLISHABLE_KEY ?? process.env.VITE_CLERK_PUBLISHABLE_KEY ?? "").startsWith("pk_test_")) throw new Error("Only development grants are supported.");
if (!email) throw new Error("Provide the owner's confirmed nujli. sign-in email.");
const users = await clerkClient.users.getUserList({ emailAddress: [email] });
if (users.data.length !== 1) throw new Error("Sign into nujli. first; no unique existing account found.");
const user = users.data[0];
if (user.publicMetadata.role === "reviewer") throw new Error("Independent reviewer accounts cannot receive organization developer access.");
await clerkClient.users.updateUserMetadata(user.id,{publicMetadata:{developerAccess:true}});
console.log("Development owner access granted. Use the Developer access button on Billing.");
