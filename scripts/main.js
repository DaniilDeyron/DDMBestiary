const MODULE_ID = "ddm-bestiary";
const SOCKET = "module.ddm-bestiary";
const DEFAULT_ENTRIES = [
  {id:"delerium-dreg",number:"014",kind:"bestiary",name:"Делириумный выродок",category:"Аберрации",subtitle:"Порождение заражённых земель",image:"",description:"Искажённое существо, порождённое воздействием делирия. Его тело покрыто кристаллическими наростами, а движения неестественно рваны.",behavior:"Проявляет крайнюю агрессию. Реагирует на источники магии. Часто встречается в заражённых зонах.",features:"Кристаллы на теле реагируют на магию. После смерти возможны выбросы делирия.",harvest:[{id:"delerium-shard",name:"Осколок делирия",quantity:1,icon:"◆"},{id:"mutated-tissue",name:"Мутировавшая ткань",quantity:2,icon:"✧"}],research:{tasks:[{id:"samples",label:"Собрать образцы существа",done:true,weight:35},{id:"combat",label:"Провести наблюдение в бою",done:true,weight:20},{id:"behavior",label:"Изучить поведение и особенности",done:false,weight:25},{id:"weakness",label:"Определить уязвимости",done:false,weight:20}]}},
  {id:"crystal-parasite",number:"015",kind:"bestiary",name:"Кристаллический паразит",category:"Аберрации",subtitle:"Неизвестный паразит",image:"",description:"Организм, тесно связанный с кристаллическими образованиями делирия. Его жизненный цикл пока не установлен.",behavior:"Наблюдения ещё не внесены.",features:"Особенности требуют изучения.",harvest:[],research:{tasks:[{id:"samples",label:"Собрать образцы существа",done:false,weight:40},{id:"behavior",label:"Изучить поведение",done:false,weight:30},{id:"weakness",label:"Определить уязвимости",done:false,weight:30}]}},
  {id:"twisted-hunter",number:"016",kind:"bestiary",name:"Искажённый охотник",category:"Аберрации",subtitle:"Хищник заражённых земель",image:"",description:"Сведения об этом существе пока отсутствуют.",behavior:"Неизвестно.",features:"Неизвестно.",harvest:[],research:{tasks:[{id:"samples",label:"Собрать образцы существа",done:false,weight:40},{id:"behavior",label:"Изучить поведение",done:false,weight:30},{id:"weakness",label:"Определить уязвимости",done:false,weight:30}]}}
];

class BestiaryApp extends Application {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions,{id:"ddm-bestiary-window",title:"DDM Bestiary",template:"modules/"+MODULE_ID+"/templates/bestiary.hbs",width:1180,height:800,resizable:true,minimizable:true,classes:["ddm-bestiary-window"]});
  }
  constructor(options={}) { super(options); this._book="bestiary"; this._selectedId=null; this._activeCategory="Аберрации"; }
  async getData() {
    const all=game.settings.get(MODULE_ID,"entries")||DEFAULT_ENTRIES;
    const entries=all.filter(e=>(e.kind||"bestiary")===this._book);
    if (!entries.some(e=>e.id===this._selectedId)) this._selectedId=entries[0]?.id||null;
    const selected=entries.find(e=>e.id===this._selectedId)||entries[0];
    const categories=[...new Set(entries.map(e=>e.category||"Прочее"))];
    if (!categories.includes(this._activeCategory)) this._activeCategory=categories[0]||"";
    const tasks=selected?.research?.tasks||[];
    const progress=tasks.length?Math.min(100,Math.round(tasks.reduce((s,t)=>s+(t.done?Number(t.weight||0):0),0))):0;
    return {entries,selected,categories,activeCategory:this._activeCategory,categoryEntries:entries.filter(e=>(e.category||"Прочее")===this._activeCategory),progress,studied:progress>=100,isGM:game.user.isGM,isBestiary:this._book==="bestiary",isRecipe:this._book==="recipes",canCreate:game.user.isGM||game.settings.get(MODULE_ID,"playersCanCreate"),harvestSlots:[0,1],nextPage:Number(selected?.number||0)+1};
  }
  activateListeners(html) {
    super.activateListeners(html);
    html.find("[data-action='book']").on("click",ev=>{this._book=ev.currentTarget.dataset.book;this._selectedId=null;this._activeCategory=this._book==="recipes"?"Рецепты":"Аберрации";this.render();});
    html.find("[data-action='select-category']").on("click",ev=>{this._activeCategory=ev.currentTarget.dataset.category;this._selectedId=this._entriesForCategory(this._activeCategory)[0]?.id||null;this.render();});
    html.find("[data-action='select-entry']").on("click",ev=>{this._selectedId=ev.currentTarget.dataset.entryId;this.render();});
    html.find("[data-action='new-entry']").on("click",()=>this._newEntry());
    html.find("[data-action='edit-entry']").on("click",()=>this._editEntry());
    html.find("[data-action='set-image']").on("click",()=>this._chooseImage());
    html.find("[data-action='task-toggle']").on("change",ev=>this._toggleTask(ev.currentTarget.dataset.taskId,ev.currentTarget.checked));
    html.find("[data-action='add-harvest']").on("click",ev=>this._addHarvest(Number(ev.currentTarget.dataset.slot)));
    html.find("[data-action='remove-harvest']").on("click",ev=>this._removeHarvest(Number(ev.currentTarget.dataset.slot)));
    html.find("[data-action='add-material']").on("click",()=>this._addMaterial());
    html.find("[data-action='remove-material']").on("click",ev=>this._removeMaterial(Number(ev.currentTarget.dataset.index)));
    html.find(".ddm-harvest-slot").on("dragover",ev=>{ev.preventDefault();ev.currentTarget.classList.add("drag-over");}).on("dragleave",ev=>ev.currentTarget.classList.remove("drag-over")).on("drop",ev=>this._dropHarvest(ev));
    html.find(".ddm-recipe-materials").on("dragover",ev=>ev.preventDefault()).on("drop",ev=>this._dropMaterial(ev));
  }
  _entriesForCategory(category) { return (game.settings.get(MODULE_ID,"entries")||[]).filter(e=>(e.kind||"bestiary")===this._book&&(e.category||"Прочее")===category); }
  async _save(entries) { await game.settings.set(MODULE_ID,"entries",entries); this.render(); }
  async _newEntry() {
    if (this._book==="recipes") return this._newRecipe();
    if (!game.user.isGM) {
      if (!game.settings.get(MODULE_ID,"playersCanCreate")) return ui.notifications.warn("Мастер отключил создание записей игроками.");
      const values=await this._entryDialog("Предложить запись бестиария");
      if (!values?.name) return;
      game.socket.emit(SOCKET,{type:"entry-request",user:game.user.name,entry:values});
      return ui.notifications.info("Запись отправлена Мастеру на подтверждение.");
    }
    const values=await this._entryDialog("Новая запись бестиария");
    if (!values?.name) return;
    const entries=foundry.utils.deepClone(game.settings.get(MODULE_ID,"entries")||[]);
    const id=foundry.utils.randomID();
    entries.push(this._makeBestiaryEntry(id,values,entries.length+1));
    await game.settings.set(MODULE_ID,"entries",entries);this._selectedId=id;this._activeCategory=values.category;this.render();
  }
  async _entryDialog(title) {
    return Dialog.prompt({title,content:"<form><div class='form-group'><label>Название существа</label><input name='name' autofocus></div><div class='form-group'><label>Раздел</label><input name='category' value='"+this._activeCategory+"'></div><div class='form-group'><label>Краткое описание</label><textarea name='description'></textarea></div></form>",callback:html=>({name:html.find("[name='name']").val()?.trim(),category:html.find("[name='category']").val()?.trim()||"Прочее",description:html.find("[name='description']").val()?.trim()||""})});
  }
  _makeBestiaryEntry(id,v,n) { return {id,number:String(n).padStart(3,"0"),kind:"bestiary",name:v.name,category:v.category,subtitle:"",image:"",description:v.description||"",behavior:"",features:"",harvest:[],research:{tasks:[{id:"samples",label:"Собрать образцы существа",done:false,weight:40},{id:"behavior",label:"Изучить поведение",done:false,weight:30},{id:"weakness",label:"Определить уязвимости",done:false,weight:30}]}}; }
  async _newRecipe() {
    if (!game.user.isGM) return ui.notifications.warn("Создавать рецепты может только Мастер.");
    const values=await Dialog.prompt({title:"Новый рецепт",content:"<form><div class='form-group'><label>Название предмета</label><input name='name' autofocus></div><div class='form-group'><label>Описание</label><textarea name='description'></textarea></div></form>",callback:html=>({name:html.find("[name='name']").val()?.trim(),description:html.find("[name='description']").val()?.trim()||""})});
    if(!values?.name)return;
    const entries=foundry.utils.deepClone(game.settings.get(MODULE_ID,"entries")||[]);const id=foundry.utils.randomID();
    entries.push({id,number:String(entries.filter(e=>e.kind==="recipe").length+1).padStart(3,"0"),kind:"recipe",name:values.name,category:"Рецепты",image:"",description:values.description,materials:[]});
    await game.settings.set(MODULE_ID,"entries",entries);this._selectedId=id;this._activeCategory="Рецепты";this.render();
  }
  async _editEntry() {
    if(!game.user.isGM)return;
    const entries=foundry.utils.deepClone(game.settings.get(MODULE_ID,"entries")||[]);const e=entries.find(x=>x.id===this._selectedId);if(!e)return;
    const recipe=e.kind==="recipe";
    const content="<form><div class='form-group'><label>Название</label><input name='name' value='"+foundry.utils.escapeHTML(e.name||"")+"'></div><div class='form-group'><label>Описание</label><textarea name='description' rows='5'>"+foundry.utils.escapeHTML(e.description||"")+"</textarea></div>"+(recipe?"":"<div class='form-group'><label>Раздел</label><input name='category' value='"+foundry.utils.escapeHTML(e.category||"")+"'></div><div class='form-group'><label>Поведение</label><textarea name='behavior'>"+foundry.utils.escapeHTML(e.behavior||"")+"</textarea></div><div class='form-group'><label>Особенности</label><textarea name='features'>"+foundry.utils.escapeHTML(e.features||"")+"</textarea></div>")+"</form>";
    new Dialog({title:"Редактировать запись",content,buttons:{save:{label:"Сохранить",callback:async html=>{e.name=html.find("[name='name']").val();e.description=html.find("[name='description']").val();if(!recipe){e.category=html.find("[name='category']").val()||"Прочее";e.behavior=html.find("[name='behavior']").val();e.features=html.find("[name='features']").val();}await game.settings.set(MODULE_ID,"entries",entries);this._activeCategory=e.category;this.render();}},cancel:{label:"Отмена"}},default:"save"}).render(true);
  }
  async _chooseImage() { if(!game.user.isGM)return;new FilePicker({type:"image",current:"worlds/"+game.world.id,callback:path=>this._updateEntry({image:path})}).render(true); }
  async _updateEntry(changes) { const entries=foundry.utils.deepClone(game.settings.get(MODULE_ID,"entries")||[]);const e=entries.find(x=>x.id===this._selectedId);if(!e)return;Object.assign(e,changes);await game.settings.set(MODULE_ID,"entries",entries);this.render(); }
  async _toggleTask(taskId,done) { if(!game.user.isGM)return;const entries=foundry.utils.deepClone(game.settings.get(MODULE_ID,"entries")||[]);const e=entries.find(x=>x.id===this._selectedId);const task=e?.research?.tasks?.find(t=>t.id===taskId);if(!task)return;task.done=done;await this._save(entries); }
  async _addHarvest(slot) { if(!game.user.isGM)return;const v=await Dialog.prompt({title:"Добавить образец",content:"<form><div class='form-group'><label>Название предмета</label><input name='name' autofocus></div><div class='form-group'><label>Количество</label><input name='quantity' type='number' min='1' value='1'></div></form>",callback:h=>({name:h.find("[name='name']").val()?.trim(),quantity:Number(h.find("[name='quantity']").val())||1})});if(!v?.name)return;const entries=foundry.utils.deepClone(game.settings.get(MODULE_ID,"entries")||[]);const e=entries.find(x=>x.id===this._selectedId);if(!e)return;e.harvest=e.harvest||[];e.harvest[slot]={id:foundry.utils.randomID(),name:v.name,quantity:v.quantity,icon:"✧"};await this._save(entries); }
  async _removeHarvest(slot) { if(!game.user.isGM)return;const entries=foundry.utils.deepClone(game.settings.get(MODULE_ID,"entries")||[]);const e=entries.find(x=>x.id===this._selectedId);if(!e)return;e.harvest[slot]=null;await this._save(entries); }
  async _addMaterial() { if(!game.user.isGM)return;const v=await Dialog.prompt({title:"Материал рецепта",content:"<form><div class='form-group'><label>Название материала</label><input name='name' autofocus></div><div class='form-group'><label>Количество</label><input name='quantity' type='number' min='1' value='1'></div></form>",callback:h=>({name:h.find("[name='name']").val()?.trim(),quantity:Number(h.find("[name='quantity']").val())||1})});if(!v?.name)return;const entries=foundry.utils.deepClone(game.settings.get(MODULE_ID,"entries")||[]);const e=entries.find(x=>x.id===this._selectedId);if(!e)return;e.materials=e.materials||[];e.materials.push(v);await this._save(entries); }
  async _removeMaterial(index) { if(!game.user.isGM)return;const entries=foundry.utils.deepClone(game.settings.get(MODULE_ID,"entries")||[]);const e=entries.find(x=>x.id===this._selectedId);if(!e)return;e.materials.splice(index,1);await this._save(entries); }
  async _dropHarvest(ev) { ev.preventDefault();ev.currentTarget.classList.remove("drag-over");if(!game.user.isGM)return;const data=TextEditor.getDragEventData(ev);const slot=Number(ev.currentTarget.dataset.slot);let item;try{item=data.uuid?await fromUuid(data.uuid):(data.type==="Item"?game.items.get(data.id):null);}catch(err){console.warn(err);}if(!item)return;const entries=foundry.utils.deepClone(game.settings.get(MODULE_ID,"entries")||[]);const e=entries.find(x=>x.id===this._selectedId);if(!e)return;e.harvest=e.harvest||[];e.harvest[slot]={id:item.id,name:item.name,quantity:1,icon:"✧",uuid:item.uuid};await this._save(entries); }
  async _dropMaterial(ev) { ev.preventDefault();if(!game.user.isGM)return;const data=TextEditor.getDragEventData(ev);let item;try{item=data.uuid?await fromUuid(data.uuid):(data.type==="Item"?game.items.get(data.id):null);}catch(err){console.warn(err);}if(!item)return;const entries=foundry.utils.deepClone(game.settings.get(MODULE_ID,"entries")||[]);const e=entries.find(x=>x.id===this._selectedId);if(!e)return;e.materials=e.materials||[];e.materials.push({name:item.name,quantity:1,uuid:item.uuid});await this._save(entries); }
}

Hooks.once("init",()=>{
  game.settings.register(MODULE_ID,"entries",{name:"Записи DDM Bestiary",scope:"world",config:false,type:Array,default:DEFAULT_ENTRIES});
  game.settings.register(MODULE_ID,"playersCanCreate",{name:"Игроки могут предлагать записи бестиария",hint:"Игроки смогут отправлять Мастеру новые записи на подтверждение.",scope:"world",config:true,type:Boolean,default:false});
});
Hooks.once("ready",()=>{
  game.socket.on(SOCKET,data=>{
    if(!game.user.isGM||data?.type!=="entry-request")return;
    if(!game.settings.get(MODULE_ID,"playersCanCreate"))return;
    const entry=data.entry||{};if(!entry.name)return;
    Dialog.confirm({title:"Новая запись от игрока",content:"Игрок <b>"+foundry.utils.escapeHTML(data.user||"Участник")+"</b> предлагает добавить запись: <b>"+foundry.utils.escapeHTML(entry.name)+"</b>. Добавить её в общий бестиарий?",yes:async()=>{
      const entries=foundry.utils.deepClone(game.settings.get(MODULE_ID,"entries")||[]);entries.push(new BestiaryApp()._makeBestiaryEntry(foundry.utils.randomID(),entry,entries.length+1));await game.settings.set(MODULE_ID,"entries",entries);ui.notifications.info("Запись игрока добавлена в бестиарий.");
    }});
  });
  game.keybindings.register(MODULE_ID,"open",{name:"Открыть бестиарий",hint:"Открыть общий бестиарий партии",editable:[{key:"KeyB",modifiers:["SHIFT"]}],onDown:()=>{new BestiaryApp().render(true);return true;},restricted:false});
  Hooks.on("getSceneControlButtons",controls=>{
    const tokenControls=Array.isArray(controls)?controls.find(c=>c.name==="token"||c.name==="tokens"):controls.tokens;if(!tokenControls)return;
    tokenControls.tools=tokenControls.tools||[];const tool={name:"ddm-bestiary-open",title:"Открыть DDM Bestiary",icon:"fas fa-book-open",button:true,visible:true,onClick:()=>new BestiaryApp().render(true)};
    if(Array.isArray(tokenControls.tools))tokenControls.tools.push(tool);else tokenControls.tools[tool.name]=tool;
  });
});
