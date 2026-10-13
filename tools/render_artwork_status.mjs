#!/usr/bin/env node
// Generate a truthful, deterministic XPENG image progress report.
// Use --check in CI; all "available" entries are separately verified against disk.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const read=(file)=>JSON.parse(fs.readFileSync(path.join(root,file),"utf8"));
function summarize(catalog,art,queue){
  const entries=new Map(art.entries.map(e=>[[e.model,e.year_group,e.exterior_color].join("\u0000"),e]));
  const masters=new Map(queue.masters.map(e=>[[e.model,e.year_group].join("\u0000"),e]));
  const byModel=[];
  const byGroup=[];
  const viewNames=["front","charging","top"];
  for(const model of catalog.models){
    let modelAvailable=0,modelSlots=0,modelPaintComplete=0,modelPaintTotal=0,modelMasters=0;
    for(const group of model.groups){
      const master=masters.get([model.id,group.id].join("\u0000"));
      if(!master)throw Error("Missing master "+model.id+"/"+group.id);
      const masterAvailable=viewNames.filter(v=>master.views[v].status==="available").length;
      if(masterAvailable===3)modelMasters++;
      let available=0,complete=0,partial=0;
      for(const color of group.colors){
        const entry=entries.get([model.id,group.id,color].join("\u0000"));
        if(!entry)throw Error("Missing artwork map "+model.id+"/"+group.id+"/"+color);
        const n=viewNames.filter(v=>entry.views[v].status==="available").length;
        available+=n;
        if(n===3)complete++;
        if(n>0&&n<3)partial++;
      }
      const slots=group.colors.length*3;
      byGroup.push({model:model.id,year_group:group.id,master_color:master.master_color,master_views:masterAvailable,master_missing:3-masterAvailable,paints:group.colors.length,complete_paints:complete,partial_paints:partial,available_views:available,total_views:slots,missing_views:slots-available,catalog_status:group.catalog_status});
      modelAvailable+=available;modelSlots+=slots;modelPaintComplete+=complete;modelPaintTotal+=group.colors.length;
    }
    byModel.push({model:model.id,groups:model.groups.length,complete_masters:modelMasters,complete_paints:modelPaintComplete,total_paints:modelPaintTotal,available_views:modelAvailable,total_views:modelSlots,missing_views:modelSlots-modelAvailable,percent:Math.round(1000*modelAvailable/modelSlots)/10});
  }
  const sum=(k)=>byModel.reduce((n,x)=>n+x[k],0);
  const total=sum("total_views"),available=sum("available_views");
  const masterViews=byGroup.reduce((n,g)=>n+g.master_views,0);
  return {schema_version:1,branch:"feature/full-model-year-paint-artwork-map-20261012",pull_request:29,
    disclaimer:"Artwork is illustrative AI-generated or derived; transparent WebP technical validity does not prove manufacturer design fidelity.",
    models:byModel.length,body_generation_groups:byGroup.length,paint_combinations:sum("total_paints"),complete_paint_combinations:sum("complete_paints"),
    partial_paint_combinations:byGroup.reduce((n,g)=>n+g.partial_paints,0),
    total_view_slots:total,available_views:available,missing_views:total-available,completion_percent:Math.round(1000*available/total)/10,
    complete_master_groups:byGroup.filter(g=>g.master_views===3).length,master_views_available:masterViews,master_views_missing:byGroup.length*3-masterViews,
    by_model:byModel,by_generation:byGroup};
}
function renderMarkdown(s){
  const barCount=Math.round(s.completion_percent/5),bar="█".repeat(barCount)+"░".repeat(20-barCount);
  const rows=s.by_model.map(m=>`| ${m.model} | ${m.complete_paints}/${m.total_paints} | ${m.available_views}/${m.total_views} | ${m.percent}% | ${m.missing_views} |`).join("\n");
  const groups=s.by_generation.map(g=>`| ${g.model} | ${g.year_group} | ${g.master_views}/3 | ${g.complete_paints}/${g.paints} | ${g.available_views}/${g.total_views} | ${g.missing_views} |`).join("\n");
  return `# XPENG Vehicle Artwork — Progress\n\n> **Work in progress — not complete.** Counts reflect actual \`available\` entries in the checked-in artwork map. CI verifies that these entries match real WebP files. This is not a continuously running render process.\n\n**${s.available_views} / ${s.total_view_slots} image views · ${s.completion_percent}%**\n\n\`${bar}\`\n\n**${s.missing_views} views remaining** across ${s.models} models, ${s.body_generation_groups} generation groups and ${s.paint_combinations} model/generation/paint combinations. **${s.complete_paint_combinations} fully populated combinations**, ${s.partial_paint_combinations} partially populated.\n\n**Master views:** ${s.complete_master_groups}/${s.body_generation_groups} generation-specific master trios complete; ${s.master_views_missing} base camera views still missing.\n\n[Latest changes (PR #29)](https://github.com/matanmesika/xpeng-vehicle-card/pull/29) · [Workflow runs](https://github.com/matanmesika/xpeng-vehicle-card/actions) · [Missing master views](../master-view-queue.json) · [Machine-readable status](../artwork-status.json)\n\n## Progress by model\n\n| Model | Complete paints | Available views | Coverage | Missing views |\n|:--|--:|--:|--:|--:|\n${rows}\n\n## Progress by generation\n\n| Model | Year group | Master trio | Complete paints | Available views | Missing views |\n|:--|:--|--:|--:|--:|--:|\n${groups}\n\n## Counting rules and caveats\n\n- A completed paint combination requires **three distinct files**: \`front.webp\`, \`charging.webp\` (rear three-quarter) and \`top.webp\` (true overhead). One available view does not count as a complete combination.\n- Year-by-year paint availability is defined in \`year-color-matrix.json\`; the artwork asset is selected by model, body-generation group and exterior colour. Trim selection does not change artwork.\n- **These renders are not official manufacturer photographs**. Some geometry, colours and wheels remain pending manufacturer-fidelity review. Technical alpha/WebP checks are not visual authenticity checks.\n- This report is regenerated from \`vehicle-catalog.json\`, \`vehicle-art-map.json\` and \`master-view-queue.json\` whenever artwork is added by the repository workflow. The displayed counts reflect the **last committed status**, not a real-time background job.\n`;
}
const status=summarize(read("vehicle-catalog.json"),read("vehicle-art-map.json"),read("master-view-queue.json"));
const outputs=[["artwork-status.json",JSON.stringify(status,null,2)+"\n"],["docs/ARTWORK_STATUS.md",renderMarkdown(status)]];
if(process.argv.includes("--check")){
  for(const [name,content] of outputs){
    if(!fs.existsSync(path.join(root,name))||fs.readFileSync(path.join(root,name),"utf8")!==content)throw Error(name+" is out of date; run node tools/render_artwork_status.mjs");
  }
}else{
  for(const [name,content] of outputs)fs.writeFileSync(path.join(root,name),content,"utf8");
}
console.log("PASS: "+status.available_views+"/"+status.total_view_slots+" artwork views ("+status.completion_percent+"%); "+status.missing_views+" pending.");
