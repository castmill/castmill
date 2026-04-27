defmodule Castmill.Repo.Migrations.UpdateWidgetOptionTranslations do
  use Ecto.Migration
  alias Ecto.Adapters.SQL

  @translations %{
    "image" => %{
      "en" => %{
        "name" => "Image",
        "description" => "Display an image.",
        "options" => %{
          "autozoom" => %{"label" => "Autozoom"},
          "duration" => %{
            "label" => "Duration",
            "description" => "The duration in seconds to display the image"
          },
          "image" => %{"label" => "Image"}
        }
      },
      "es" => %{
        "name" => "Imagen",
        "description" => "Muestra una imagen.",
        "options" => %{
          "autozoom" => %{"label" => "Zoom automático"},
          "duration" => %{
            "label" => "Duración",
            "description" => "La duración en segundos para mostrar la imagen"
          },
          "image" => %{"label" => "Imagen"}
        }
      },
      "sv" => %{
        "name" => "Bild",
        "description" => "Visa en bild.",
        "options" => %{
          "autozoom" => %{"label" => "Automatisk zoom"},
          "duration" => %{
            "label" => "Varaktighet",
            "description" => "Varaktigheten i sekunder för att visa bilden"
          },
          "image" => %{"label" => "Bild"}
        }
      },
      "de" => %{
        "name" => "Bild",
        "description" => "Zeigt ein Bild an.",
        "options" => %{
          "autozoom" => %{"label" => "Automatischer Zoom"},
          "duration" => %{
            "label" => "Dauer",
            "description" => "Die Dauer in Sekunden, für die das Bild angezeigt wird"
          },
          "image" => %{"label" => "Bild"}
        }
      },
      "fr" => %{
        "name" => "Image",
        "description" => "Afficher une image.",
        "options" => %{
          "autozoom" => %{"label" => "Zoom automatique"},
          "duration" => %{
            "label" => "Durée",
            "description" => "La durée en secondes pendant laquelle afficher l'image"
          },
          "image" => %{"label" => "Image"}
        }
      },
      "zh" => %{
        "name" => "图片",
        "description" => "显示图片。",
        "options" => %{
          "autozoom" => %{"label" => "自动缩放"},
          "duration" => %{"label" => "时长", "description" => "显示图片的持续时间（秒）"},
          "image" => %{"label" => "图片"}
        }
      },
      "ar" => %{
        "name" => "صورة",
        "description" => "عرض صورة.",
        "options" => %{
          "autozoom" => %{"label" => "تكبير تلقائي"},
          "duration" => %{"label" => "المدة", "description" => "المدة بالثواني لعرض الصورة"},
          "image" => %{"label" => "الصورة"}
        }
      },
      "ko" => %{
        "name" => "이미지",
        "description" => "이미지를 표시합니다.",
        "options" => %{
          "autozoom" => %{"label" => "자동 확대"},
          "duration" => %{"label" => "지속 시간", "description" => "이미지를 표시할 시간(초)"},
          "image" => %{"label" => "이미지"}
        }
      },
      "ja" => %{
        "name" => "画像",
        "description" => "画像を表示します。",
        "options" => %{
          "autozoom" => %{"label" => "自動ズーム"},
          "duration" => %{"label" => "表示時間", "description" => "画像を表示する秒数"},
          "image" => %{"label" => "画像"}
        }
      }
    },
    "video" => %{
      "en" => %{"name" => "Video", "description" => "Display a video."},
      "es" => %{"name" => "Video", "description" => "Muestra un video."},
      "sv" => %{"name" => "Video", "description" => "Visar en video."},
      "de" => %{"name" => "Video", "description" => "Zeigt ein Video an."},
      "fr" => %{"name" => "Vidéo", "description" => "Affiche une vidéo."},
      "zh" => %{"name" => "视频", "description" => "显示视频。"},
      "ar" => %{"name" => "فيديو", "description" => "عرض مقطع فيديو."},
      "ko" => %{"name" => "비디오", "description" => "비디오를 표시합니다."},
      "ja" => %{"name" => "ビデオ", "description" => "ビデオを表示します。"}
    },
    "weather" => %{
      "en" => %{
        "name" => "Weather",
        "description" => "Display weather information.",
        "options" => %{
          "location" => %{
            "label" => "Location",
            "description" => "Select the location for weather information"
          }
        }
      },
      "es" => %{
        "name" => "Clima",
        "description" => "Muestra información meteorológica.",
        "options" => %{
          "location" => %{
            "label" => "Ubicación",
            "description" => "Selecciona la ubicación para la información meteorológica"
          }
        }
      },
      "sv" => %{
        "name" => "Väder",
        "description" => "Visar väderinformation.",
        "options" => %{
          "location" => %{"label" => "Plats", "description" => "Välj plats för väderinformation"}
        }
      },
      "de" => %{
        "name" => "Wetter",
        "description" => "Zeigt Wetterinformationen an.",
        "options" => %{
          "location" => %{
            "label" => "Standort",
            "description" => "Wählen Sie den Standort für Wetterinformationen"
          }
        }
      },
      "fr" => %{
        "name" => "Météo",
        "description" => "Affiche des informations météorologiques.",
        "options" => %{
          "location" => %{
            "label" => "Localisation",
            "description" => "Sélectionnez l'emplacement pour les informations météorologiques"
          }
        }
      },
      "zh" => %{
        "name" => "天气",
        "description" => "显示天气信息。",
        "options" => %{"location" => %{"label" => "位置", "description" => "选择用于天气信息的位置"}}
      },
      "ar" => %{
        "name" => "الطقس",
        "description" => "عرض معلومات الطقس.",
        "options" => %{
          "location" => %{"label" => "الموقع", "description" => "اختر الموقع لمعلومات الطقس"}
        }
      },
      "ko" => %{
        "name" => "날씨",
        "description" => "날씨 정보를 표시합니다.",
        "options" => %{"location" => %{"label" => "위치", "description" => "날씨 정보에 사용할 위치를 선택하세요"}}
      },
      "ja" => %{
        "name" => "天気",
        "description" => "天気情報を表示します。",
        "options" => %{"location" => %{"label" => "位置", "description" => "天気情報の場所を選択してください"}}
      }
    },
    "web" => %{
      "en" => %{"name" => "Web", "description" => "Displays the content of a web page."},
      "es" => %{"name" => "Web", "description" => "Muestra el contenido de una página web."},
      "sv" => %{"name" => "Webb", "description" => "Visar innehållet på en webbsida."},
      "de" => %{"name" => "Web", "description" => "Zeigt den Inhalt einer Webseite an."},
      "fr" => %{"name" => "Web", "description" => "Affiche le contenu d'une page web."},
      "zh" => %{"name" => "网页", "description" => "显示网页内容。"},
      "ar" => %{"name" => "ويب", "description" => "عرض محتوى صفحة ويب."},
      "ko" => %{"name" => "웹", "description" => "웹 페이지 내용을 표시합니다."},
      "ja" => %{"name" => "ウェブ", "description" => "ウェブページの内容を表示します。"}
    },
    "intro" => %{
      "en" => %{"name" => "Intro", "description" => "An intro widget with a Castmill logo"},
      "es" => %{
        "name" => "Intro",
        "description" => "Un widget de introducción con el logo de Castmill"
      },
      "sv" => %{"name" => "Intro", "description" => "En intro-widget med Castmills logotyp"},
      "de" => %{"name" => "Intro", "description" => "Ein Intro-Widget mit dem Castmill-Logo"},
      "fr" => %{
        "name" => "Intro",
        "description" => "Un widget d'introduction avec le logo Castmill"
      },
      "zh" => %{"name" => "介绍", "description" => "带有 Castmill 标志的介绍小部件"},
      "ar" => %{"name" => "مقدمة", "description" => "أداة تقديمية مع شعار Castmill"},
      "ko" => %{"name" => "인트로", "description" => "Castmill 로고가 있는 인트로 위젯"},
      "ja" => %{"name" => "イントロ", "description" => "Castmillロゴ付きのイントロウィジェット"}
    },
    "layout-portrait-3" => %{
      "en" => %{
        "name" => "Layout Portrait 3",
        "description" => "Display 3 playlists in a portrait layout."
      },
      "es" => %{
        "name" => "Diseño Retrato 3",
        "description" => "Muestra 3 listas de reproducción en un diseño vertical."
      },
      "sv" => %{
        "name" => "Porträttlayout 3",
        "description" => "Visar 3 spellistor i ett stående format."
      },
      "de" => %{
        "name" => "Hochformat-Layout 3",
        "description" => "Zeigt 3 Wiedergabelisten in einem Hochformat-Layout an."
      },
      "fr" => %{
        "name" => "Mise en page Portrait 3",
        "description" => "Affiche 3 listes de lecture dans une mise en page portrait."
      },
      "zh" => %{"name" => "竖向布局 3", "description" => "以竖向布局显示 3 个播放列表。"},
      "ar" => %{"name" => "تخطيط عمودي 3", "description" => "عرض 3 قوائم تشغيل في تخطيط عمودي."},
      "ko" => %{"name" => "세로 레이아웃 3", "description" => "세로 레이아웃으로 3개의 재생 목록을 표시합니다."},
      "ja" => %{"name" => "縦向きレイアウト 3", "description" => "縦向きレイアウトで3つのプレイリストを表示します。"}
    },
    "layout-widget" => %{
      "en" => %{
        "name" => "Layout Widget",
        "description" =>
          "Display multiple playlists using a pre-defined layout. Select a layout and assign playlists to each zone."
      },
      "es" => %{
        "name" => "Widget de Diseño",
        "description" =>
          "Muestra múltiples listas de reproducción usando un diseño predefinido. Selecciona un diseño y asigna listas de reproducción a cada zona."
      },
      "sv" => %{
        "name" => "Layoutwidget",
        "description" =>
          "Visar flera spellistor med en fördefinierad layout. Välj en layout och tilldela spellistor till varje zon."
      },
      "de" => %{
        "name" => "Layout-Widget",
        "description" =>
          "Zeigt mehrere Wiedergabelisten mit einem vordefinierten Layout an. Wählen Sie ein Layout und weisen Sie jeder Zone Wiedergabelisten zu."
      },
      "fr" => %{
        "name" => "Widget de mise en page",
        "description" =>
          "Affiche plusieurs listes de lecture à l'aide d'une mise en page prédéfinie. Sélectionnez une mise en page et attribuez des listes de lecture à chaque zone."
      },
      "zh" => %{"name" => "布局小部件", "description" => "使用预定义布局显示多个播放列表。选择布局并将播放列表分配到每个区域。"},
      "ar" => %{
        "name" => "أداة التخطيط",
        "description" =>
          "عرض قوائم تشغيل متعددة باستخدام تخطيط محدد مسبقاً. اختر تخطيطاً وخصص قوائم تشغيل لكل منطقة."
      },
      "ko" => %{
        "name" => "레이아웃 위젯",
        "description" => "미리 정의된 레이아웃을 사용하여 여러 재생 목록을 표시합니다. 레이아웃을 선택하고 각 구역에 재생 목록을 할당하세요."
      },
      "ja" => %{
        "name" => "レイアウトウィジェット",
        "description" => "事前定義されたレイアウトを使用して複数のプレイリストを表示します。レイアウトを選択し、各ゾーンにプレイリストを割り当てます。"
      }
    },
    "qr-code" => %{
      "en" => %{
        "name" => "QR Code",
        "description" => "Displays a QR code for URLs or text with optional caption.",
        "options" => %{
          "content" => %{
            "label" => "Content",
            "description" => "The URL or text to encode in the QR code"
          },
          "caption" => %{
            "label" => "Caption",
            "placeholder" => "Scan me!",
            "description" => "Optional text to display below the QR code"
          },
          "caption_size" => %{
            "label" => "Caption Size",
            "description" => "Font size of the caption text (e.g., 1.5em, 2em, 3em)"
          },
          "text_color" => %{"label" => "Text Color", "description" => "Color of the caption text"},
          "background" => %{
            "label" => "Background",
            "description" => "Background color of the widget"
          },
          "qr_background" => %{
            "label" => "QR Background",
            "description" => "Background color of the QR code"
          },
          "foreground_color" => %{
            "label" => "Foreground Color",
            "description" => "Color of the QR code modules"
          },
          "duration" => %{
            "label" => "Duration",
            "description" => "Duration in seconds to display the QR code"
          }
        }
      },
      "es" => %{
        "name" => "Código QR",
        "description" => "Muestra un código QR para URLs o texto con título opcional.",
        "options" => %{
          "content" => %{
            "label" => "Contenido",
            "description" => "La URL o el texto que se codificará en el código QR"
          },
          "caption" => %{
            "label" => "Título",
            "placeholder" => "¡Escanéame!",
            "description" => "Texto opcional para mostrar debajo del código QR"
          },
          "caption_size" => %{
            "label" => "Tamaño del título",
            "description" => "Tamaño de fuente del texto del título (p. ej., 1.5em, 2em, 3em)"
          },
          "text_color" => %{
            "label" => "Color del texto",
            "description" => "Color del texto del título"
          },
          "background" => %{"label" => "Fondo", "description" => "Color de fondo del widget"},
          "qr_background" => %{
            "label" => "Fondo del QR",
            "description" => "Color de fondo del código QR"
          },
          "foreground_color" => %{
            "label" => "Color de primer plano",
            "description" => "Color de los módulos del código QR"
          },
          "duration" => %{
            "label" => "Duración",
            "description" => "Duración en segundos para mostrar el código QR"
          }
        }
      },
      "sv" => %{
        "name" => "QR-kod",
        "description" => "Visar en QR-kod för webbadresser eller text med valfri bildtext.",
        "options" => %{
          "content" => %{
            "label" => "Innehåll",
            "description" => "Webbadressen eller texten som ska kodas i QR-koden"
          },
          "caption" => %{
            "label" => "Bildtext",
            "placeholder" => "Skanna mig!",
            "description" => "Valfri text som visas under QR-koden"
          },
          "caption_size" => %{
            "label" => "Bildtextstorlek",
            "description" => "Teckenstorlek för bildtexten (t.ex. 1.5em, 2em, 3em)"
          },
          "text_color" => %{"label" => "Textfärg", "description" => "Färg på bildtexten"},
          "background" => %{"label" => "Bakgrund", "description" => "Widgetens bakgrundsfärg"},
          "qr_background" => %{
            "label" => "QR-bakgrund",
            "description" => "Bakgrundsfärg för QR-koden"
          },
          "foreground_color" => %{
            "label" => "Förgrundsfärg",
            "description" => "Färg på QR-kodens moduler"
          },
          "duration" => %{
            "label" => "Varaktighet",
            "description" => "Varaktighet i sekunder för att visa QR-koden"
          }
        }
      },
      "de" => %{
        "name" => "QR-Code",
        "description" => "Zeigt einen QR-Code für URLs oder Text mit optionalem Untertitel an.",
        "options" => %{
          "content" => %{
            "label" => "Inhalt",
            "description" => "Die URL oder der Text, der im QR-Code codiert werden soll"
          },
          "caption" => %{
            "label" => "Untertitel",
            "placeholder" => "Scanne mich!",
            "description" => "Optionaler Text, der unter dem QR-Code angezeigt wird"
          },
          "caption_size" => %{
            "label" => "Untertitelgröße",
            "description" => "Schriftgröße des Untertiteltexts (z. B. 1.5em, 2em, 3em)"
          },
          "text_color" => %{"label" => "Textfarbe", "description" => "Farbe des Untertiteltexts"},
          "background" => %{
            "label" => "Hintergrund",
            "description" => "Hintergrundfarbe des Widgets"
          },
          "qr_background" => %{
            "label" => "QR-Hintergrund",
            "description" => "Hintergrundfarbe des QR-Codes"
          },
          "foreground_color" => %{
            "label" => "Vordergrundfarbe",
            "description" => "Farbe der QR-Code-Module"
          },
          "duration" => %{
            "label" => "Dauer",
            "description" => "Dauer in Sekunden zur Anzeige des QR-Codes"
          }
        }
      },
      "fr" => %{
        "name" => "Code QR",
        "description" =>
          "Affiche un code QR pour les URLs ou le texte avec une légende optionnelle.",
        "options" => %{
          "content" => %{
            "label" => "Contenu",
            "description" => "L'URL ou le texte à encoder dans le code QR"
          },
          "caption" => %{
            "label" => "Légende",
            "placeholder" => "Scannez-moi !",
            "description" => "Texte optionnel à afficher sous le code QR"
          },
          "caption_size" => %{
            "label" => "Taille de la légende",
            "description" => "Taille de police du texte de légende (par ex. 1.5em, 2em, 3em)"
          },
          "text_color" => %{
            "label" => "Couleur du texte",
            "description" => "Couleur du texte de la légende"
          },
          "background" => %{
            "label" => "Arrière-plan",
            "description" => "Couleur d'arrière-plan du widget"
          },
          "qr_background" => %{
            "label" => "Arrière-plan du QR",
            "description" => "Couleur d'arrière-plan du code QR"
          },
          "foreground_color" => %{
            "label" => "Couleur de premier plan",
            "description" => "Couleur des modules du code QR"
          },
          "duration" => %{
            "label" => "Durée",
            "description" => "Durée en secondes d'affichage du code QR"
          }
        }
      },
      "zh" => %{
        "name" => "二维码",
        "description" => "显示 URL 或文本的二维码，带有可选说明。",
        "options" => %{
          "content" => %{"label" => "内容", "description" => "要编码到二维码中的 URL 或文本"},
          "caption" => %{
            "label" => "说明文字",
            "placeholder" => "扫一扫！",
            "description" => "显示在二维码下方的可选文本"
          },
          "caption_size" => %{"label" => "说明文字大小", "description" => "说明文字的字体大小（例如 1.5em、2em、3em）"},
          "text_color" => %{"label" => "文字颜色", "description" => "说明文字的颜色"},
          "background" => %{"label" => "背景", "description" => "组件的背景颜色"},
          "qr_background" => %{"label" => "二维码背景", "description" => "二维码的背景颜色"},
          "foreground_color" => %{"label" => "前景色", "description" => "二维码模块的颜色"},
          "duration" => %{"label" => "时长", "description" => "显示二维码的秒数"}
        }
      },
      "ar" => %{
        "name" => "رمز QR",
        "description" => "عرض رمز QR للروابط أو النصوص مع تعليق توضيحي اختياري.",
        "options" => %{
          "content" => %{
            "label" => "المحتوى",
            "description" => "الرابط أو النص المراد ترميزه في رمز QR"
          },
          "caption" => %{
            "label" => "التسمية التوضيحية",
            "placeholder" => "امسحني!",
            "description" => "نص اختياري لعرضه أسفل رمز QR"
          },
          "caption_size" => %{
            "label" => "حجم التسمية التوضيحية",
            "description" => "حجم خط نص التسمية التوضيحية (مثل 1.5em أو 2em أو 3em)"
          },
          "text_color" => %{"label" => "لون النص", "description" => "لون نص التسمية التوضيحية"},
          "background" => %{"label" => "الخلفية", "description" => "لون خلفية الويدجت"},
          "qr_background" => %{"label" => "خلفية رمز QR", "description" => "لون خلفية رمز QR"},
          "foreground_color" => %{"label" => "لون المقدمة", "description" => "لون وحدات رمز QR"},
          "duration" => %{"label" => "المدة", "description" => "المدة بالثواني لعرض رمز QR"}
        }
      },
      "ko" => %{
        "name" => "QR 코드",
        "description" => "선택적 캡션과 함께 URL 또는 텍스트의 QR 코드를 표시합니다.",
        "options" => %{
          "content" => %{"label" => "내용", "description" => "QR 코드로 인코딩할 URL 또는 텍스트"},
          "caption" => %{
            "label" => "캡션",
            "placeholder" => "스캔해 보세요!",
            "description" => "QR 코드 아래에 표시할 선택적 텍스트"
          },
          "caption_size" => %{
            "label" => "캡션 크기",
            "description" => "캡션 텍스트의 글꼴 크기(예: 1.5em, 2em, 3em)"
          },
          "text_color" => %{"label" => "텍스트 색상", "description" => "캡션 텍스트의 색상"},
          "background" => %{"label" => "배경", "description" => "위젯의 배경색"},
          "qr_background" => %{"label" => "QR 배경", "description" => "QR 코드의 배경색"},
          "foreground_color" => %{"label" => "전경색", "description" => "QR 코드 모듈의 색상"},
          "duration" => %{"label" => "표시 시간", "description" => "QR 코드를 표시할 시간(초)"}
        }
      },
      "ja" => %{
        "name" => "QRコード",
        "description" => "オプションのキャプション付きでURLまたはテキストのQRコードを表示します。",
        "options" => %{
          "content" => %{"label" => "内容", "description" => "QRコードにエンコードするURLまたはテキスト"},
          "caption" => %{
            "label" => "キャプション",
            "placeholder" => "スキャンしてね！",
            "description" => "QRコードの下に表示する任意のテキスト"
          },
          "caption_size" => %{
            "label" => "キャプションサイズ",
            "description" => "キャプションテキストのフォントサイズ（例: 1.5em、2em、3em）"
          },
          "text_color" => %{"label" => "テキスト色", "description" => "キャプションテキストの色"},
          "background" => %{"label" => "背景", "description" => "ウィジェットの背景色"},
          "qr_background" => %{"label" => "QR背景", "description" => "QRコードの背景色"},
          "foreground_color" => %{"label" => "前景色", "description" => "QRコードモジュールの色"},
          "duration" => %{"label" => "表示時間", "description" => "QRコードを表示する秒数"}
        }
      }
    },
    "rss-news" => %{
      "en" => %{"name" => "RSS News", "description" => "Display an RSS news feed."},
      "es" => %{"name" => "Noticias RSS", "description" => "Muestra un feed de noticias RSS."},
      "sv" => %{"name" => "RSS-nyheter", "description" => "Visar ett RSS-nyhetsflöde."},
      "de" => %{
        "name" => "RSS-Nachrichten",
        "description" => "Zeigt einen RSS-Nachrichtenfeed an."
      },
      "fr" => %{"name" => "Actualités RSS", "description" => "Affiche un flux d'actualités RSS."},
      "zh" => %{"name" => "RSS 新闻", "description" => "显示 RSS 新闻源。"},
      "ar" => %{"name" => "أخبار RSS", "description" => "عرض موجز أخبار RSS."},
      "ko" => %{"name" => "RSS 뉴스", "description" => "RSS 뉴스 피드를 표시합니다."},
      "ja" => %{"name" => "RSSニュース", "description" => "RSSニュースフィードを表示します。"}
    },
    "spotify-now-playing" => %{
      "en" => %{
        "name" => "Spotify Now Playing",
        "description" =>
          "Displays the currently playing track from a Spotify account with album artwork, track information, and playback progress."
      },
      "es" => %{
        "name" => "Reproduciendo en Spotify",
        "description" =>
          "Muestra la pista que se está reproduciendo desde una cuenta de Spotify con portada del álbum, información de la pista y progreso de reproducción."
      },
      "sv" => %{
        "name" => "Spotify spelar nu",
        "description" =>
          "Visar det aktuellt spelande spåret från ett Spotify-konto med albumomslag, spårinformation och uppspelningsförlopp."
      },
      "de" => %{
        "name" => "Spotify – Aktueller Titel",
        "description" =>
          "Zeigt den aktuell abgespielten Titel eines Spotify-Kontos mit Album-Cover, Titelinformationen und Wiedergabefortschritt an."
      },
      "fr" => %{
        "name" => "Spotify en cours de lecture",
        "description" =>
          "Affiche la piste en cours de lecture depuis un compte Spotify avec la pochette de l'album, les informations de la piste et la progression de la lecture."
      },
      "zh" => %{
        "name" => "Spotify 正在播放",
        "description" => "显示 Spotify 账户中当前正在播放的曲目，包括专辑封面、曲目信息和播放进度。"
      },
      "ar" => %{
        "name" => "ما يُشغَّل على Spotify",
        "description" =>
          "عرض المقطع الموسيقي قيد التشغيل من حساب Spotify مع غلاف الألبوم ومعلومات المقطع وتقدم التشغيل."
      },
      "ko" => %{
        "name" => "Spotify 현재 재생 중",
        "description" => "앨범 아트워크, 트랙 정보 및 재생 진행 상황과 함께 Spotify 계정에서 현재 재생 중인 트랙을 표시합니다."
      },
      "ja" => %{
        "name" => "Spotify 再生中",
        "description" => "アルバムアートワーク、トラック情報、再生進捗状況と共にSpotifyアカウントの現在再生中のトラックを表示します。"
      }
    },
    "stock-ticker" => %{
      "en" => %{
        "name" => "Stock Ticker",
        "description" =>
          "Displays a scrolling ticker of real-time stock quotes with price changes."
      },
      "es" => %{
        "name" => "Cotizaciones de Bolsa",
        "description" =>
          "Muestra un ticker desplazable de cotizaciones de bolsa en tiempo real con cambios de precio."
      },
      "sv" => %{
        "name" => "Börskursband",
        "description" => "Visar ett rullande band med realtidsaktiekurser med prisförändringar."
      },
      "de" => %{
        "name" => "Börsen-Ticker",
        "description" =>
          "Zeigt einen scrollenden Ticker mit Echtzeit-Börsenkursen und Preisveränderungen an."
      },
      "fr" => %{
        "name" => "Cours boursiers",
        "description" =>
          "Affiche un ticker défilant de cours boursiers en temps réel avec les variations de prix."
      },
      "zh" => %{"name" => "股票行情", "description" => "显示带有价格变化的实时股票报价滚动行情。"},
      "ar" => %{
        "name" => "شريط أسعار الأسهم",
        "description" => "عرض شريط متحرك بأسعار الأسهم في الوقت الفعلي مع تغييرات الأسعار."
      },
      "ko" => %{"name" => "주식 시세 표시기", "description" => "가격 변동과 함께 실시간 주식 시세의 스크롤 시세 표시기를 표시합니다."},
      "ja" => %{"name" => "株式ティッカー", "description" => "価格変動付きのリアルタイム株価見積もりのスクロールティッカーを表示します。"}
    },
    "location-display-demo" => %{
      "en" => %{
        "name" => "Location Display",
        "description" => "Displays location information with coordinates and address.",
        "options" => %{
          "title" => %{
            "label" => "Title",
            "description" => "Title text to display above the location",
            "placeholder" => "Enter title"
          },
          "location" => %{"label" => "Location", "description" => "Select a location on the map"}
        }
      },
      "es" => %{
        "name" => "Visualización de Ubicación",
        "description" => "Muestra información de ubicación con coordenadas y dirección.",
        "options" => %{
          "title" => %{
            "label" => "Título",
            "description" => "Texto del título para mostrar encima de la ubicación",
            "placeholder" => "Introducir título"
          },
          "location" => %{
            "label" => "Ubicación",
            "description" => "Selecciona una ubicación en el mapa"
          }
        }
      },
      "sv" => %{
        "name" => "Platsvisning",
        "description" => "Visar platsinformation med koordinater och adress.",
        "options" => %{
          "title" => %{
            "label" => "Titel",
            "description" => "Titeltext som visas ovanför platsen",
            "placeholder" => "Ange titel"
          },
          "location" => %{"label" => "Plats", "description" => "Välj en plats på kartan"}
        }
      },
      "de" => %{
        "name" => "Standortanzeige",
        "description" => "Zeigt Standortinformationen mit Koordinaten und Adresse an.",
        "options" => %{
          "title" => %{
            "label" => "Titel",
            "description" => "Titeltext, der oberhalb des Standorts angezeigt wird",
            "placeholder" => "Titel eingeben"
          },
          "location" => %{
            "label" => "Standort",
            "description" => "Wählen Sie einen Standort auf der Karte"
          }
        }
      },
      "fr" => %{
        "name" => "Affichage de localisation",
        "description" =>
          "Affiche des informations de localisation avec les coordonnées et l'adresse.",
        "options" => %{
          "title" => %{
            "label" => "Titre",
            "description" => "Texte du titre à afficher au-dessus de la localisation",
            "placeholder" => "Saisir un titre"
          },
          "location" => %{
            "label" => "Localisation",
            "description" => "Sélectionnez un emplacement sur la carte"
          }
        }
      },
      "zh" => %{
        "name" => "位置显示",
        "description" => "显示带有坐标和地址的位置信息。",
        "options" => %{
          "title" => %{"label" => "标题", "description" => "显示在位置上方的标题文本", "placeholder" => "输入标题"},
          "location" => %{"label" => "位置", "description" => "在地图上选择位置"}
        }
      },
      "ar" => %{
        "name" => "عرض الموقع",
        "description" => "عرض معلومات الموقع مع الإحداثيات والعنوان.",
        "options" => %{
          "title" => %{
            "label" => "العنوان",
            "description" => "نص العنوان الذي يظهر فوق الموقع",
            "placeholder" => "أدخل العنوان"
          },
          "location" => %{"label" => "الموقع", "description" => "اختر موقعاً على الخريطة"}
        }
      },
      "ko" => %{
        "name" => "위치 표시",
        "description" => "좌표 및 주소와 함께 위치 정보를 표시합니다.",
        "options" => %{
          "title" => %{
            "label" => "제목",
            "description" => "위치 위에 표시할 제목 텍스트",
            "placeholder" => "제목 입력"
          },
          "location" => %{"label" => "위치", "description" => "지도에서 위치를 선택하세요"}
        }
      },
      "ja" => %{
        "name" => "位置表示",
        "description" => "座標と住所付きの位置情報を表示します。",
        "options" => %{
          "title" => %{
            "label" => "タイトル",
            "description" => "位置情報の上に表示するタイトルテキスト",
            "placeholder" => "タイトルを入力"
          },
          "location" => %{"label" => "位置", "description" => "地図上で場所を選択してください"}
        }
      }
    }
  }

  def up do
    execute("""
    ALTER TABLE widgets
    ADD COLUMN IF NOT EXISTS translations jsonb DEFAULT '{}'::jsonb
    """)

    execute("""
    UPDATE widgets
    SET translations = (translations #>> '{}')::jsonb
    WHERE translations IS NOT NULL
      AND jsonb_typeof(translations) = 'string'
    """)

    for {slug, translations} <- @translations do
      SQL.query!(
        repo(),
        "UPDATE widgets SET translations = $1::jsonb WHERE slug = $2",
        [Jason.encode!(translations), slug]
      )
    end
  end

  def down do
    :ok
  end
end
