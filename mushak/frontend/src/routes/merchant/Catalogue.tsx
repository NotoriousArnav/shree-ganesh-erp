import ProductList from "@/components/product-list";

/**
 * Catalogue: the product definitions this shop sells — names, SKUs, prices and
 * GST. Stock quantities are handled on the Inventory tab.
 */
export default function Catalogue() {
  return <ProductList variant="catalogue" />;
}
