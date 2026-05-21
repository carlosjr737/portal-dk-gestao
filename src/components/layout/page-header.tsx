type PageHeaderProps = {
  title: string;
  description?: string;
};

export function PageHeader({ title, description }: PageHeaderProps) {
  return (
    <section className="border-b border-border pb-6">
      <p className="text-sm font-medium uppercase tracking-wide text-primary">
        Portal DK Gestão
      </p>
      <h1 className="mt-2 text-2xl font-semibold tracking-normal text-foreground sm:text-3xl">
        {title}
      </h1>
      {description ? (
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          {description}
        </p>
      ) : null}
    </section>
  );
}
