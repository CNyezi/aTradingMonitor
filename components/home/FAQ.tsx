import { useTranslations } from "next-intl";

type FAQItem = {
  question: string;
  answer: string;
};

const FAQItem = ({ faq }: { faq: FAQItem }) => {
  return (
    <div className="card rounded-xl p-6 shadow-sm border dark:border-gray-800">
      <div className="flex items-center mb-3">
        <h3 className="text-lg font-semibold">{faq.question}</h3>
      </div>
      <div className="text-muted-foreground">
        <p>{faq.answer}</p>
      </div>
    </div>
  );
};

export default function FAQ() {
  const t = useTranslations("Landing.FAQ");

  const faqs: FAQItem[] = t.raw("items");

  return (
    <section id="faq" className="py-20 bg-white dark:bg-gray-900">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">{t("title")}</h2>
          <p className="text-xl text-muted-foreground">{t("description")}</p>
        </div>

        <div className="space-y-6">
          {faqs.map((faq) => (
            <FAQItem key={faq.question} faq={faq} />
          ))}
        </div>
      </div>
    </section>
  );
}
