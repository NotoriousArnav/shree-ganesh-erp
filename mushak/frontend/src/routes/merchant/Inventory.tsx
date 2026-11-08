import ProductList from "@/components/product-list";

/**
 * Inventory: the stock of goods this shop sells. Stock movements, values and
 * reorder levels live here; product details live in the Catalogue tab.
 */
export default function Inventory() {
  return <ProductList variant="inventory" />;
}
