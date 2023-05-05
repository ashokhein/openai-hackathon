//Copied from OpenSource
import Markdoc from '@markdoc/markdoc';
import type { Content, Root } from 'mdast';
import { fromMarkdown } from 'mdast-util-from-markdown';
import { mdxFromMarkdown } from 'mdast-util-mdx';
import { toMarkdown } from 'mdast-util-to-markdown';
import { mdxjs } from 'micromark-extension-mdxjs';
import TurndownService from 'turndown';
import { u } from 'unist-builder';
import { filter } from 'unist-util-filter';

const turndown = new TurndownService({
    headingStyle: 'atx',
    codeBlockStyle: 'fenced',
});

turndown.addRule('pre', {
    filter: 'pre',
    replacement: (content: string, node: any) => {
        const lang = node.getAttribute('data-language') || '';
        return `\n\n\`\`\`${lang}\n${content.trim()}\n\`\`\`\n\n`;
    },
});

const splitTreeBy = (tree: Root, predicate: (node: Content) => boolean) => {
    return tree.children.reduce<Root[]>((trees, node) => {
        const [lastTree] = trees.slice(-1);

        if (!lastTree || predicate(node)) {
            const tree: Root = u('root', [node]);
            return trees.concat(tree);
        }

        lastTree.children.push(node);
        return trees;
    }, []);
};

// Use `asMDX = false` for Markdoc content. What might happen in Markdoc
// is that the page contains a statement like `{HI_THERE}`, which is
// rendered verbatim in Markdown/Markdoc. It's also not a problem à priori
// for MDX, since it's semantically correct MDX (no eval is happening here).
// However, specifically for `{HI_THERE}` with an underscore, the Markdoc
// transform will escape the underscore, turning it into `{HI\_THERE}`, and
// then it's actually semantically incorrect MDX, because what goes inside the
// curly braces is treated as a variable/expression, and `HI\_THERE` is
// no a valid JS variable/expression, so the parsing will fail.
// Similarly, statements like "<10" are valid Markdown/Markdoc, but not
// valid MDX (https://github.com/micromark/micromark-extension-mdx-jsx/issues/7)
// and we don't want this to break Markdoc.
const splitMarkdownIntoSections = (
    content: string,
    asMDX: boolean,
): string[] => {
    const mdxTree = fromMarkdown(
        content,
        asMDX
            ? {
                extensions: [mdxjs()],
                mdastExtensions: [mdxFromMarkdown()],
            }
            : {},
    );

    // Remove all JSX and expressions from MDX
    const mdTree = filter(
        mdxTree,
        (node) =>
            ![
                'mdxjsEsm',
                'mdxJsxFlowElement',
                'mdxJsxTextElement',
                'mdxFlowExpression',
                'mdxTextExpression',
            ].includes(node.type),
    );

    if (!mdTree) {
        return [];
    }

    const sectionTrees = splitTreeBy(mdTree, (node) => node.type === 'heading');
    return sectionTrees.map((tree) => toMarkdown(tree));
};

const splitMarkdocIntoSections = (content: string): string[] => {
    const ast = Markdoc.parse(content);

    // In Markdoc, we make an exception and transform {% img %}
    // and {% image %} tags to <img> html since this is a common
    // use as an improvement to the ![]() Markdown tag. We could
    // offer to pass such rules via the API call.
    const transformed = Markdoc.transform(ast, {
        tags: {
            img: { render: 'img', attributes: { src: { type: String } } },
            image: { render: 'img', attributes: { src: { type: String } } },
        },
    });
    const html = Markdoc.renderers.html(transformed) || '';
    const md = turndown.turndown(html);
    return splitMarkdownIntoSections(md, false);
};

export const processMarkdown = (content: string) => {
    return splitMarkdocIntoSections(content);
};
