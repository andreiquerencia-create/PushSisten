import PDVContent from './_components/pdv-content';

export default function PDVPage({ searchParams }: { searchParams: { edit?: string } }) {
  return <PDVContent editSaleId={searchParams?.edit} />;
}
