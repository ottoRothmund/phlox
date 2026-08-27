/* eslint-disable @next/next/no-img-element */
import { ArrowSquareOut } from "@phosphor-icons/react/dist/ssr";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import {
  resolveReadmeAssetUrl,
  type RepositoryReadme as RepositoryReadmeData,
} from "@/lib/github";

function repositoryLink(
  source: string,
  owner: string,
  name: string,
  readmePath: string,
): string {
  if (source.startsWith("#")) return source;
  try {
    const url = new URL(source);
    return url.protocol === "http:" || url.protocol === "https:"
      ? url.toString()
      : "#";
  } catch {
    const directory = readmePath.includes("/")
      ? readmePath.slice(0, readmePath.lastIndexOf("/") + 1)
      : "";
    const path = source.startsWith("/")
      ? source.slice(1)
      : `${directory}${source}`;
    return `https://github.com/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/blob/HEAD/${path}`;
  }
}

export function RepositoryReadme({
  readme,
  owner,
  name,
}: {
  readme: RepositoryReadmeData;
  owner: string;
  name: string;
}) {
  return (
    <section aria-labelledby="readme-heading">
      <div className="flex items-center justify-between gap-4 border-b border-border pb-4">
        <h2
          id="readme-heading"
          className="text-xl font-semibold tracking-[-0.025em]"
        >
          README
        </h2>
        <a
          href={readme.htmlUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-foreground"
        >
          View source <ArrowSquareOut size={13} />
        </a>
      </div>

      {readme.screenshotUrls.length > 0 ? (
        <section className="border-b border-border py-7" aria-labelledby="screenshots-heading">
          <h3 id="screenshots-heading" className="text-sm font-semibold">
            Screenshots
          </h3>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {readme.screenshotUrls.map((source, index) => (
              <a
                key={source}
                href={source}
                target="_blank"
                rel="noreferrer"
                className="block overflow-hidden border border-border bg-subtle"
              >
                <img
                  src={source}
                  alt={`${name} screenshot ${index + 1}`}
                  loading="lazy"
                  className="aspect-[16/10] h-full w-full object-contain"
                />
              </a>
            ))}
          </div>
        </section>
      ) : null}

      <article className="readme-content py-7 text-sm leading-7 text-muted">
        <ReactMarkdown
          skipHtml
          remarkPlugins={[remarkGfm]}
          components={{
            h1: ({ children }) => (
              <h2 className="mb-4 mt-8 text-2xl font-semibold tracking-[-0.03em] text-foreground first:mt-0">
                {children}
              </h2>
            ),
            h2: ({ children }) => (
              <h3 className="mb-3 mt-8 border-b border-border pb-2 text-xl font-semibold tracking-[-0.025em] text-foreground">
                {children}
              </h3>
            ),
            h3: ({ children }) => (
              <h4 className="mb-2 mt-6 text-base font-semibold text-foreground">
                {children}
              </h4>
            ),
            p: ({ children }) => <p className="my-4 max-w-[78ch]">{children}</p>,
            strong: ({ children }) => (
              <strong style={{ fontWeight: 600 }} className="text-foreground">
                {children}
              </strong>
            ),
            a: ({ href = "", children }) => {
              const resolved = repositoryLink(href, owner, name, readme.path);
              const external = resolved.startsWith("http");
              return (
                <a
                  href={resolved}
                  target={external ? "_blank" : undefined}
                  rel={external ? "noreferrer" : undefined}
                  className="break-all font-medium text-foreground underline decoration-border underline-offset-4 hover:decoration-foreground"
                >
                  {children}
                </a>
              );
            },
            img: ({ src = "", alt = "" }) => {
              const resolved = resolveReadmeAssetUrl(
                typeof src === "string" ? src : "",
                owner,
                name,
                readme.path,
              );
              return resolved ? (
                <img
                  src={resolved}
                  alt={alt}
                  loading="lazy"
                  className="my-6 max-h-[680px] w-auto max-w-full border border-border bg-subtle object-contain"
                />
              ) : null;
            },
            ul: ({ children }) => (
              <ul className="my-4 list-disc space-y-1 pl-6">{children}</ul>
            ),
            ol: ({ children }) => (
              <ol className="my-4 list-decimal space-y-1 pl-6">{children}</ol>
            ),
            blockquote: ({ children }) => (
              <blockquote className="my-5 border-l-2 border-border pl-4 text-muted">
                {children}
              </blockquote>
            ),
            pre: ({ children }) => (
              <pre className="my-5 overflow-x-auto border border-border bg-subtle p-4 font-mono text-xs leading-6 text-foreground">
                {children}
              </pre>
            ),
            code: ({ children, className }) => (
              <code
                className={`${className || ""} font-mono text-[0.9em] text-foreground`}
              >
                {children}
              </code>
            ),
            table: ({ children }) => (
              <table className="my-6 block w-full overflow-x-auto border-collapse text-left text-xs">
                {children}
              </table>
            ),
            th: ({ children }) => (
              <th className="border border-border bg-subtle px-3 py-2 font-semibold text-foreground">
                {children}
              </th>
            ),
            td: ({ children }) => (
              <td className="border border-border px-3 py-2">{children}</td>
            ),
            hr: () => <hr className="my-8 border-0 border-t border-border" />,
          }}
        >
          {readme.content}
        </ReactMarkdown>
      </article>
    </section>
  );
}
