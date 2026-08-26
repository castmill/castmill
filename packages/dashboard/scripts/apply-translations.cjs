const fs = require("fs");
const path = require("path");

const translations = {
  // Spanish
  es: {
    "filters.teamLabel": "Equipo",
    "filters.teamPlaceholder": "Seleccionar equipo",
    "filters.teamClear": "Limpiar filtro de equipo",
    "organization.roleEditor": "Editor",
    "organization.roleDescriptions.admin": "Acceso completo incluyendo gestión de la organización",
    "organization.roleDescriptions.manager": "Puede gestionar equipos y la mayoría de recursos",
    "organization.roleDescriptions.member":
      "Usuario estándar (predeterminado), puede gestionar contenido",
    "organization.roleDescriptions.editor":
      "Gestión completa de contenido, no puede gestionar equipos",
    "organization.roleDescriptions.publisher": "Como editor más acciones de flujo de publicación",
    "organization.roleDescriptions.device_manager": "Gestión completa de dispositivos y canales",
    "organization.roleDescriptions.guest": "Acceso de solo lectura a recursos",
    "organization.teamRoleDescriptions.admin": "Puede gestionar miembros del equipo y recursos",
    "organization.teamRoleDescriptions.member": "Puede acceder y editar recursos del equipo",
    "organization.teamRoleDescriptions.installer":
      "Token temporal para registro de dispositivos (expira en 24h)",
  },

  // Swedish
  sv: {
    "filters.teamLabel": "Team",
    "filters.teamPlaceholder": "Välj team",
    "filters.teamClear": "Rensa teamfilter",
    "organization.roleEditor": "Redaktör",
    "organization.roleDescriptions.admin": "Full åtkomst inklusive organisationshantering",
    "organization.roleDescriptions.manager": "Kan hantera team och de flesta resurser",
    "organization.roleDescriptions.member": "Standardanvändare (standard), kan hantera innehåll",
    "organization.roleDescriptions.editor": "Full innehållshantering, kan inte hantera team",
    "organization.roleDescriptions.publisher":
      "Som redaktör plus arbetsflödesåtgärder för publicering",
    "organization.roleDescriptions.device_manager": "Full enhets- och kanalhantering",
    "organization.roleDescriptions.guest": "Läsbehörighet till resurser",
    "organization.teamRoleDescriptions.admin": "Kan hantera teammedlemmar och resurser",
    "organization.teamRoleDescriptions.member": "Kan komma åt och redigera teamresurser",
    "organization.teamRoleDescriptions.installer":
      "Tillfällig token för enhetsregistrering (utgår om 24h)",
  },

  // German
  de: {
    "filters.teamLabel": "Team",
    "filters.teamPlaceholder": "Team auswählen",
    "filters.teamClear": "Teamfilter löschen",
    "organization.roleEditor": "Redakteur",
    "organization.roleDescriptions.admin": "Vollzugriff einschließlich Organisationsverwaltung",
    "organization.roleDescriptions.manager": "Kann Teams und die meisten Ressourcen verwalten",
    "organization.roleDescriptions.member": "Standardbenutzer (Standard), kann Inhalte verwalten",
    "organization.roleDescriptions.editor":
      "Vollständige Inhaltsverwaltung, kann keine Teams verwalten",
    "organization.roleDescriptions.publisher":
      "Wie Redakteur plus Veröffentlichungs-Workflow-Aktionen",
    "organization.roleDescriptions.device_manager": "Vollständige Geräte- und Kanalverwaltung",
    "organization.roleDescriptions.guest": "Nur-Lese-Zugriff auf Ressourcen",
    "organization.teamRoleDescriptions.admin": "Kann Teammitglieder und Ressourcen verwalten",
    "organization.teamRoleDescriptions.member":
      "Kann auf Teamressourcen zugreifen und diese bearbeiten",
    "organization.teamRoleDescriptions.installer":
      "Temporäres Token für Geräteregistrierung (läuft in 24h ab)",
  },

  // French
  fr: {
    "filters.teamLabel": "Équipe",
    "filters.teamPlaceholder": "Sélectionner une équipe",
    "filters.teamClear": "Effacer le filtre d'équipe",
    "organization.roleEditor": "Éditeur",
    "organization.roleDescriptions.admin": "Accès complet incluant la gestion de l'organisation",
    "organization.roleDescriptions.manager": "Peut gérer les équipes et la plupart des ressources",
    "organization.roleDescriptions.member":
      "Utilisateur standard (par défaut), peut gérer le contenu",
    "organization.roleDescriptions.editor":
      "Gestion complète du contenu, ne peut pas gérer les équipes",
    "organization.roleDescriptions.publisher": "Comme éditeur plus actions de flux de publication",
    "organization.roleDescriptions.device_manager": "Gestion complète des appareils et canaux",
    "organization.roleDescriptions.guest": "Accès en lecture seule aux ressources",
    "organization.teamRoleDescriptions.admin":
      "Peut gérer les membres de l'équipe et les ressources",
    "organization.teamRoleDescriptions.member":
      "Peut accéder et modifier les ressources de l'équipe",
    "organization.teamRoleDescriptions.installer":
      "Jeton temporaire pour l'enregistrement d'appareil (expire dans 24h)",
  },

  // Chinese (Mandarin)
  zh: {
    "filters.teamLabel": "团队",
    "filters.teamPlaceholder": "选择团队",
    "filters.teamClear": "清除团队筛选",
    "organization.roleEditor": "编辑者",
    "organization.roleDescriptions.admin": "完全访问权限，包括组织管理",
    "organization.roleDescriptions.manager": "可以管理团队和大多数资源",
    "organization.roleDescriptions.member": "标准用户（默认），可以管理内容",
    "organization.roleDescriptions.editor": "完整的内容管理，不能管理团队",
    "organization.roleDescriptions.publisher": "类似编辑者，加上发布工作流操作",
    "organization.roleDescriptions.device_manager": "完整的设备和频道管理",
    "organization.roleDescriptions.guest": "对资源的只读访问权限",
    "organization.teamRoleDescriptions.admin": "可以管理团队成员和资源",
    "organization.teamRoleDescriptions.member": "可以访问和编辑团队资源",
    "organization.teamRoleDescriptions.installer": "用于设备注册的临时令牌（24小时后过期）",
  },

  // Arabic
  ar: {
    "filters.teamLabel": "الفريق",
    "filters.teamPlaceholder": "اختر فريق",
    "filters.teamClear": "مسح فلتر الفريق",
    "organization.roleEditor": "محرر",
    "organization.roleDescriptions.admin": "وصول كامل بما في ذلك إدارة المنظمة",
    "organization.roleDescriptions.manager": "يمكنه إدارة الفرق ومعظم الموارد",
    "organization.roleDescriptions.member": "مستخدم قياسي (افتراضي)، يمكنه إدارة المحتوى",
    "organization.roleDescriptions.editor": "إدارة كاملة للمحتوى، لا يمكنه إدارة الفرق",
    "organization.roleDescriptions.publisher": "مثل المحرر بالإضافة إلى إجراءات سير عمل النشر",
    "organization.roleDescriptions.device_manager": "إدارة كاملة للأجهزة والقنوات",
    "organization.roleDescriptions.guest": "وصول للقراءة فقط إلى الموارد",
    "organization.teamRoleDescriptions.admin": "يمكنه إدارة أعضاء الفريق والموارد",
    "organization.teamRoleDescriptions.member": "يمكنه الوصول وتحرير موارد الفريق",
    "organization.teamRoleDescriptions.installer": "رمز مؤقت لتسجيل الجهاز (ينتهي خلال 24 ساعة)",
  },

  // Korean
  ko: {
    "filters.teamLabel": "팀",
    "filters.teamPlaceholder": "팀 선택",
    "filters.teamClear": "팀 필터 지우기",
    "organization.roleEditor": "편집자",
    "organization.roleDescriptions.admin": "조직 관리를 포함한 전체 액세스",
    "organization.roleDescriptions.manager": "팀 및 대부분의 리소스를 관리할 수 있음",
    "organization.roleDescriptions.member": "표준 사용자(기본값), 콘텐츠를 관리할 수 있음",
    "organization.roleDescriptions.editor": "전체 콘텐츠 관리, 팀을 관리할 수 없음",
    "organization.roleDescriptions.publisher": "편집자와 동일하며 게시 워크플로 작업 추가",
    "organization.roleDescriptions.device_manager": "전체 기기 및 채널 관리",
    "organization.roleDescriptions.guest": "리소스에 대한 읽기 전용 액세스",
    "organization.teamRoleDescriptions.admin": "팀 구성원 및 리소스를 관리할 수 있음",
    "organization.teamRoleDescriptions.member": "팀 리소스에 액세스하고 편집할 수 있음",
    "organization.teamRoleDescriptions.installer": "기기 등록용 임시 토큰(24시간 후 만료)",
  },

  // Japanese
  ja: {
    "filters.teamLabel": "チーム",
    "filters.teamPlaceholder": "チームを選択",
    "filters.teamClear": "チームフィルターをクリア",
    "organization.roleEditor": "編集者",
    "organization.roleDescriptions.admin": "組織管理を含む完全なアクセス権",
    "organization.roleDescriptions.manager": "チームとほとんどのリソースを管理できます",
    "organization.roleDescriptions.member": "標準ユーザー（デフォルト）、コンテンツを管理できます",
    "organization.roleDescriptions.editor": "完全なコンテンツ管理、チームは管理できません",
    "organization.roleDescriptions.publisher":
      "編集者と同様に公開ワークフローアクションが追加されます",
    "organization.roleDescriptions.device_manager": "完全なデバイスとチャンネル管理",
    "organization.roleDescriptions.guest": "リソースへの読み取り専用アクセス",
    "organization.teamRoleDescriptions.admin": "チームメンバーとリソースを管理できます",
    "organization.teamRoleDescriptions.member": "チームリソースにアクセスして編集できます",
    "organization.teamRoleDescriptions.installer":
      "デバイス登録用の一時トークン（24時間後に期限切れ）",
  },
};

function isForbiddenKey(key) {
  return key === "__proto__" || key === "constructor" || key === "prototype";
}

function setNestedValue(obj, path, value) {
  const keys = path.split(".");
  let current = obj;

  for (let i = 0; i < keys.length - 1; i++) {
    if (isForbiddenKey(keys[i])) {
      // Skip assignment to forbidden keys for security
      return;
    }
    if (!current[keys[i]]) {
      current[keys[i]] = {};
    }
    current = current[keys[i]];
  }

  if (isForbiddenKey(keys[keys.length - 1])) {
    // Skip assignment to forbidden keys for security
    return;
  }

  current[keys[keys.length - 1]] = value;
}

function translateLanguage(lang, translations) {
  const filePath = path.join(__dirname, `../src/i18n/locales/${lang}.json`);
  const content = JSON.parse(fs.readFileSync(filePath, "utf8"));

  let count = 0;
  for (const [key, translation] of Object.entries(translations)) {
    setNestedValue(content, key, translation);
    count++;
  }

  fs.writeFileSync(filePath, JSON.stringify(content, null, 2) + "\n", "utf8");
  console.log(`✅ ${lang.toUpperCase()}: Translated ${count} strings`);
}

// Translate all languages
for (const [lang, langTranslations] of Object.entries(translations)) {
  translateLanguage(lang, langTranslations);
}

console.log("\n🎉 All translations completed!");
