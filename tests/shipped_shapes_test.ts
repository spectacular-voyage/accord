import { assertEquals } from "@std/assert";
import { SHIPPED_SHAPES_TURTLE } from "../src/shacl/shipped_shapes.ts";

Deno.test("generated shipped shapes module matches accord-shacl.ttl bytes", async () => {
  const source = await Deno.readTextFile("accord-shacl.ttl");

  assertEquals(SHIPPED_SHAPES_TURTLE, source);
});
