import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ARTICLES, type Article, articleCard, articleFile, articlePath, feedPath } from "../../../lib/articles.ts";
import { CARD } from "../../../lib/social-card.ts";
import { DoorDocument } from "../../../lib/page.tsx";

type Params = { params: Promise<{ slug: string }> };

const find = async ({ params }: Params): Promise<Article> => {
  const { slug } = await params;
  const article = ARTICLES.find((a) => a.slug === slug);
  if (!article) notFound();
  return article;
};

export const dynamicParams = false;

export function generateStaticParams(): { slug: string }[] {
  return ARTICLES.map((a) => ({ slug: a.slug }));
}

/** Each article names its own card, so a link to it previews as its headline rather than the site's. */
export async function generateMetadata(props: Params): Promise<Metadata> {
  const article = await find(props);
  const images = [
    {
      url: articleCard(article),
      width: CARD.width,
      height: CARD.height,
      type: "image/png",
      alt: `Coral Reef Ventures: ${article.title}`,
    },
  ];
  return {
    title: article.title,
    description: article.summary,
    alternates: { canonical: articlePath(article), types: { "application/rss+xml": feedPath } },
    openGraph: {
      siteName: "Coral Reef Ventures",
      type: "article",
      locale: "en_US",
      title: article.title,
      description: article.summary,
      url: articlePath(article),
      publishedTime: article.published,
      images,
    },
    twitter: { card: "summary_large_image", title: article.title, description: article.summary, images },
  };
}

/** One article (CRV-016), its body in Markset at content/articles/<slug>.md. */
export default async function Page(props: Params) {
  const article = await find(props);
  return <DoorDocument file={articleFile(article)} />;
}
