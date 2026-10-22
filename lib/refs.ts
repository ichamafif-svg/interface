/** Lien vers n'importe quel objet du contrat (ObjectRef). La résolution se fait côté serveur : app/[product]/ref. */
export const refHref = (product: string, ref: { kind: string; id: string }) =>
  `/${product}/ref/${ref.kind}/${encodeURIComponent(ref.id)}`;
