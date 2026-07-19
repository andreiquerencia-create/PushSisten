export const SEGMENT_CATEGORIES: Record<string, string[]> = {
  roupas: ['Blusas', 'Calças', 'Vestidos', 'Shorts', 'Saias', 'Jaquetas', 'Conjuntos'],
  feminino: ['Blusas', 'Vestidos', 'Saias', 'Conjuntos', 'Bodies', 'Macacões'],
  masculino: ['Camisetas', 'Camisas', 'Calças', 'Bermudas', 'Jaquetas', 'Moletons'],
  infantil: ['Bodies', 'Conjuntos Infantis', 'Vestidos Infantis', 'Shorts Infantis', 'Pijamas'],
  calcados: ['Tênis', 'Sandálias', 'Botas', 'Chinelos', 'Sapatos'],
  acessorios: ['Bijuterias', 'Bolsas', 'Cintos', 'Óculos', 'Relógios', 'Carteiras'],
  cosmeticos: ['Maquiagem', 'Cuidados com a Pele', 'Cabelo', 'Unhas', 'Perfumes'],
  bazar: ['Utilidades', 'Decoração', 'Presentes', 'Papelaria'],
  variedades: ['Eletrônicos', 'Ferramentas', 'Brinquedos', 'Casa', 'Organização'],
};

export function getCategoriesForSegments(segments: string[]): string[] {
  const categories = new Set<string>();
  for (const segment of segments) {
    const key = segment.toLowerCase();
    const cats = SEGMENT_CATEGORIES[key];
    if (cats) {
      cats.forEach(c => categories.add(c));
    }
  }
  return Array.from(categories);
}
