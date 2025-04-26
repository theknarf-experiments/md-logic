import { fromMarkdown }          from 'mdast-util-from-markdown';
import { gfm }                   from 'micromark-extension-gfm';
import { gfmFromMarkdown }       from 'mdast-util-gfm';
import acorn from 'acorn';
import { mdxjsEsm }              from 'micromark-extension-mdxjs-esm';
import { mdxjsEsmFromMarkdown }  from 'mdast-util-mdxjs-esm';
import { visit }                 from 'unist-util-visit';
import { Doc } from './document';

export function mdToDoc(markdown: string, fileName = 'doc.md'): Doc {
	const tree = fromMarkdown(markdown, {
		extensions: [
			gfm(),
			mdxjsEsm({
				acorn,
				acornOptions: { ecmaVersion: 2020, sourceType: 'module' }
			})
		],
		mdastExtensions:  [gfmFromMarkdown(), mdxjsEsmFromMarkdown()]
	});

	const doc: Doc = { name: fileName.replace(/\.md$/,''),
		assumptions: [], infer: [] };

	/* -------- collect imports (mdxjsEsm nodes) ------------------------- */
	visit(tree, 'mdxjsEsm', (node: any) => {
		const m = node.value.match(/from\s+['"]\.\/([\w-]+)\.md['"]/);
		if (m) (doc.import ??= []).push(m[1]);
	});

	/* -------- task-list & bullet processing ---------------------------- */
	visit(tree, 'listItem', (li: any) => {
		// 1) GitHub-flavoured task list  [x]/[ ]
		// Task‑list item? Remark-GFM sets checked to boolean
		if (typeof li.checked === 'boolean') {
			const rawText = collectText(li);
			doc.assumptions.push({
				id  : doc.assumptions.length + 1,
				value: !!li.checked,
				text : rawText
			});
			return;
		}

    // 2) inference item: unchecked list item with nested inlineCode expression
    try {
      const titleNode = li.children.find((c: any) => c.type === 'paragraph');
      const subList = li.children.find((c:any)=>c.type==='list');

      // find inlineCode either inside this listItem or in the next sibling
      let code: any = null;
      visit(subList, 'text', (n:any)=>{ if (!code) code = n; });

      const parseCodeNode = (codeNode) => {
        // "`1 & 2 & $import`"
        const expr  = codeNode.value.match(/`([^`]*)`/);
        const deps = expr[1].split('&')
          .map(s => s.trim())
          .map(x => x.startsWith('$') ? x.slice(1) : +x);

        return deps;
      }

      if (titleNode) {
        const title = collectText(titleNode);
        doc.infer.push({
          id: doc.assumptions.length + doc.infer.length + 1,
          text: title,
          dependsOn: code ? parseCodeNode(code) : [],
        });
      }
    } catch (e) {

    }
  });

  return doc;
};

function collectText(node: any): string {
  let txt = '';
  visit(node,'text',(n:any)=>{ txt+=n.value; });
  return txt.trim();
}

