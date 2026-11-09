const MODULE_ID = "ddm-bestiary";

const DEFAULT_ENTRIES = [
  {
    id: "delerium-dreg",
    number: "014",
    name: "Делириумный выродок",
    category: "Аберрации",
    subtitle: "Порождение заражённых земель",
    image: "",
    description: "Искажённое существо, порождённое воздействием делирия. Его тело покрыто кристаллическими наростами, а движения неестественно рваны.",
    behavior: "Проявляет крайнюю агрессию. Реагирует на источники магии. Часто встречается в заражённых зонах.",
    features: "Кристаллы на теле реагируют на магию. После смерти возможны выбросы делирия.",
    harvest: [
      { id: "delerium-shard", name: "Осколок делирия", quantity: 1, icon: "◆" },
      { id: "mutated-tissue", name: "Мутировавшая ткань", quantity: 2, icon: "✧" }
    ],
    research: {
      tasks: [
        { id: "samples", label: "Собрать образцы существа", done: true, weight: 35 },
        { id: "combat", label: "Провести наблюдение в бою", done: true, weight: 20 },
        { id: "behavior", label: "Изучить поведение и особенности", done: false, weight: 25 },
        { id: "weakness", label: "Определить уязвимости", done: false, weight: 20 }
      ]
    }
  },
  {
    id: "crystal-parasite",
    number: "015",
    name: "Кристаллический паразит",
    category: "Аберрации",
    subtitle: "Неизвестный паразит",
    image: "",
    description: "Организм, тесно связанный с кристаллическими образованиями делирия. Его жизненный цикл пока не установлен.",
    behavior: "Наблюдения ещё не внесены.",
    features: "Особенности требуют изучения.",
    harvest: [],
    research: { tasks: [
      { id: "samples", label: "Собрать образцы существа", done: false, weight: 40 },
      { id: "behavior", label: "Изучить поведение", done: false, weight: 30 },
      { id: "weakness", label: "Определить уязвимости", done: false, weight: 30 }
    ]}
  },
  {
    id: "twisted-hunter",
    number: "016",
    name: "Искажённый охотник",
    category: "Аберрации",
    subtitle: "Хищник заражённых земель",
    image: "",
    description: "Сведения об этом существе пока отсутствуют.",
    behavior: "Неизвестно.",
    features: "Неизвестно.",
    harvest: [],
    research: { tasks: [
      { id: "samples", label: "Собрать образцы существа", done: false, weight: 40 },
      { id: "behavior", label: "Изучить поведение", done: false, weight: 30 },
      { id: "weakness", label: "Определить уязвимости", done: false, weight: 30 }
    ]}
  }
];

class BestiaryApp extends Application {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: "ddm-bestiary-window",
      title: "Бестиарий",
      template: `modules/${MODULE_ID}/templates/bestiary.hbs`,
      width: 1180,
      height: 800,
      resizable: true,
      minimizable: true,
      classes: ["ddm-bestiary-window"]
    });
  }

  constructor(options = {}) {
    super(options);
    this._selectedId = DEFAULT_ENTRIES[0].id;
    this._activeCategory = "Аберрации";
  }

  async getData() {
    const entries = await game.settings.get(MODULE_ID, "entries");
    const selected = entries.find(e => e.id === this._selectedId) ?? entries[0];
    const categories = [...new Set(entries.map(e => e.category || "Прочее"))];
    const progress = selected ? this._progress(selected) : 0;
    return {
      entries,
      selected,
      categories,
      activeCategory: this._activeCategory,
      categoryEntries: entries.filter(e => (e.category || "Прочее") === this._activeCategory),
      progress,
      studied: progress >= 100,
      isGM: game.user.isGM,
      harvestSlots: [0, 1],
      nextPage: Number(selected?.number || 0) + 1
    };
  }

  _progress(entry) {
    const tasks = entry?.research?.tasks ?? [];
    if (!tasks.length) return 0;
    return Math.min(100, Math.round(tasks.reduce((sum, task) =>
      sum + (task.done ? Number(task.weight || 0) : 0), 0)));
  }

  activateListeners(html) {
    super.activateListeners(html);
    html.find("[data-action='select-category']").on("click", ev => {
      this._activeCategory = ev.currentTarget.dataset.category;
      const first = this._entriesForCategory(this._activeCategory)[0];
      if (first) this._selectedId = first.id;
      this.render();
    });
    html.find("[data-action='select-entry']").on("click", ev => {
      this._selectedId = ev.currentTarget.dataset.entryId;
      this.render();
    });
    html.find("[data-action='task-toggle']").on("change", ev => {
      if (!game.user.isGM) {
        ui.notifications.warn("Изменять общий прогресс пока может только Мастер.");
        ev.currentTarget.checked = !ev.currentTarget.checked;
        return;
      }
      this._toggleTask(ev.currentTarget.dataset.taskId, ev.currentTarget.checked);
    });
    html.find("[data-action='new-entry']").on("click", () => this._newEntry());
    html.find("[data-action='edit-entry']").on("click", () => this._editEntry());
    html.find("[data-action='set-image']").on("click", () => this._chooseImage());
    html.find("[data-action='remove-harvest']").on("click", ev => {
      this._removeHarvest(Number(ev.currentTarget.dataset.slot));
    });
    html.find("[data-action='add-harvest']").on("click", ev => {
      this._addHarvest(Number(ev.currentTarget.dataset.slot));
    });
    html.find(".ddm-harvest-slot").on("dragover", ev => {
      ev.preventDefault();
      ev.currentTarget.classList.add("drag-over");
    }).on("dragleave", ev => ev.currentTarget.classList.remove("drag-over"))
      .on("drop", ev => this._dropHarvest(ev));
  }

  _entriesForCategory(category) {
    return (game.settings.get(MODULE_ID, "entries") || [])
      .filter(e => (e.category || "Прочее") === category);
  }

  async _toggleTask(taskId, done) {
    const entries = foundry.utils.deepClone(game.settings.get(MODULE_ID, "entries"));
    const entry = entries.find(e => e.id === this._selectedId);
    if (!entry) return;
    const task = entry.research.tasks.find(t => t.id === taskId);
    if (!task) return;
    task.done = done;
    await game.settings.set(MODULE_ID, "entries", entries);
    this.render();
  }

  async _newEntry() {
    if (!game.user.isGM) {
      ui.notifications.warn("Создание новых записей пока доступно только Мастеру.");
      return;
    }
    const name = await Dialog.prompt({
      title: "Новая запись",
      content: `<form><div class="form-group"><label>Название существа</label><input name="name" autofocus /></div><div class="form-group"><label>Раздел</label><input name="category" value="${this._activeCategory}" /></div></form>`,
      callback: html => ({
        name: html.find("[name='name']").val()?.trim(),
        category: html.find("[name='category']").val()?.trim() || "Прочее"
      })
    });
    if (!name?.name) return;
    const entries = foundry.utils.deepClone(game.settings.get(MODULE_ID, "entries"));
    const id = foundry.utils.randomID();
    entries.push({
      id, number: String(entries.length + 1).padStart(3, "0"),
      name: name.name, category: name.category, subtitle: "",
      image: "", description: "", behavior: "", features: "", harvest: [],
      research: { tasks: [
        { id: "samples", label: "Собрать образцы существа", done: false, weight: 40 },
        { id: "behavior", label: "Изучить поведение", done: false, weight: 30 },
        { id: "weakness", label: "Определить уязвимости", done: false, weight: 30 }
      ]}
    });
    await game.settings.set(MODULE_ID, "entries", entries);
    this._selectedId = id;
    this._activeCategory = name.category;
    this.render();
  }

  async _editEntry() {
    const entries = foundry.utils.deepClone(game.settings.get(MODULE_ID, "entries"));
    const entry = entries.find(e => e.id === this._selectedId);
    if (!entry) return;
    const content = `<form class="ddm-edit-form">
      <div class="form-group"><label>Название</label><input name="name" value="${foundry.utils.escapeHTML(entry.name)}"/></div>
      <div class="form-group"><label>Раздел</label><input name="category" value="${foundry.utils.escapeHTML(entry.category)}"/></div>
      <div class="form-group"><label>Путь к изображению</label><input name="image" value="${foundry.utils.escapeHTML(entry.image || "")}"/></div>
      <div class="form-group"><label>Описание</label><textarea name="description" rows="3">${foundry.utils.escapeHTML(entry.description || "")}</textarea></div>
      <div class="form-group"><label>Поведение</label><textarea name="behavior" rows="3">${foundry.utils.escapeHTML(entry.behavior || "")}</textarea></div>
      <div class="form-group"><label>Особенности</label><textarea name="features" rows="3">${foundry.utils.escapeHTML(entry.features || "")}</textarea></div>
    </form>`;
    new Dialog({
      title: "Редактирование записи",
      content,
      buttons: {
        save: { label: "Сохранить", callback: async html => {
          entry.name = html.find("[name='name']").val();
          entry.category = html.find("[name='category']").val() || "Прочее";
          entry.image = html.find("[name='image']").val();
          entry.description = html.find("[name='description']").val();
          entry.behavior = html.find("[name='behavior']").val();
          entry.features = html.find("[name='features']").val();
          await game.settings.set(MODULE_ID, "entries", entries);
          this._activeCategory = entry.category;
          this.render();
        }},
        cancel: { label: "Отмена" }
      },
      default: "save"
    }).render(true);
  }

  async _chooseImage() {
    const picker = new FilePicker({
      type: "image",
      current: "worlds/" + game.world.id,
      callback: path => this._updateEntry({ image: path })
    });
    picker.render(true);
  }

  async _updateEntry(changes) {
    const entries = foundry.utils.deepClone(game.settings.get(MODULE_ID, "entries"));
    const entry = entries.find(e => e.id === this._selectedId);
    if (!entry) return;
    Object.assign(entry, changes);
    await game.settings.set(MODULE_ID, "entries", entries);
    this.render();
  }

  async _removeHarvest(slot) {
    const entries = foundry.utils.deepClone(game.settings.get(MODULE_ID, "entries"));
    const entry = entries.find(e => e.id === this._selectedId);
    if (!entry) return;
    entry.harvest[slot] = null;
    await game.settings.set(MODULE_ID, "entries", entries);
    this.render();
  }

  async _addHarvest(slot) {
    const name = await Dialog.prompt({
      title: "Добавить образец",
      content: `<form><div class="form-group"><label>Название предмета</label><input name="name" autofocus /></div><div class="form-group"><label>Количество</label><input name="quantity" type="number" min="1" value="1"/></div></form>`,
      callback: html => ({ name: html.find("[name='name']").val()?.trim(), quantity: Number(html.find("[name='quantity']").val()) || 1 })
    });
    if (!name?.name) return;
    const entries = foundry.utils.deepClone(game.settings.get(MODULE_ID, "entries"));
    const entry = entries.find(e => e.id === this._selectedId);
    if (!entry) return;
    entry.harvest = entry.harvest || [];
    entry.harvest[slot] = { id: foundry.utils.randomID(), name: name.name, quantity: name.quantity, icon: "✧" };
    await game.settings.set(MODULE_ID, "entries", entries);
    this.render();
  }

  async _dropHarvest(ev) {
    ev.preventDefault();
    ev.currentTarget.classList.remove("drag-over");
    const data = TextEditor.getDragEventData(ev);
    const slot = Number(ev.currentTarget.dataset.slot);
    if (!data || (!data.uuid && data.type !== "Item")) return;
    let item;
    try {
      if (data.uuid) item = await fromUuid(data.uuid);
      else if (data.type === "Item") item = game.items.get(data.id);
      
    } catch (err) { console.warn(err); }
    if (!item) return ui.notifications.warn("Не удалось прочитать перетаскиваемый объект.");
    const entries = foundry.utils.deepClone(game.settings.get(MODULE_ID, "entries"));
    const entry = entries.find(e => e.id === this._selectedId);
    if (!entry) return;
    entry.harvest = entry.harvest || [];
    entry.harvest[slot] = { id: item.id, name: item.name, quantity: 1, icon: "✧", uuid: item.uuid };
    await game.settings.set(MODULE_ID, "entries", entries);
    this.render();
  }
}

Hooks.once("init", () => {
  game.settings.register(MODULE_ID, "entries", {
    name: "Bestiary entries",
    scope: "world",
    config: false,
    type: Array,
    default: DEFAULT_ENTRIES
  });
});

Hooks.once("ready", () => {
  game.keybindings.register(MODULE_ID, "open", {
    name: "Открыть бестиарий",
    hint: "Открыть общий бестиарий партии",
    editable: [{ key: "KeyB", modifiers: ["SHIFT"] }],
    onDown: () => { new BestiaryApp().render(true); return true; },
    restricted: false
  });

  Hooks.on("getSceneControlButtons", controls => {
    // Foundry V12 exposes the controls as an array of SceneControl objects.
    const tokenControls = Array.isArray(controls)
      ? controls.find(control => control.name === "token" || control.name === "tokens")
      : controls.tokens;
    if (!tokenControls) return;

    tokenControls.tools = tokenControls.tools || [];
    const openButton = {
      name: "ddm-bestiary-open",
      title: "Открыть бестиарий",
      icon: "fas fa-book-open",
      button: true,
      visible: true,
      onClick: () => new BestiaryApp().render(true)
    };

    if (Array.isArray(tokenControls.tools)) {
      tokenControls.tools.push(openButton);
    } else {
      tokenControls.tools[openButton.name] = openButton;
    }
  });
});

Hooks.on("renderActorSheet", (app, html) => {
  // reserved for future inventory integration
});
