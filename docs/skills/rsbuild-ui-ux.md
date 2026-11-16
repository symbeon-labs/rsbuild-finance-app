# RSBUILD OS — UI/UX & Design System Architecture Skill

## 1. Manifesto de Design & Visão de Maestria
A plataforma **RSBUILD OS** é o sistema nervoso executivo de governança, auditoria pericial e observabilidade financeira para holdings e empresas operacionais.

**Regra Fundamental de Maestria Visual:**
> *"Nenhuma página, modal, aba ou componente interno do RSBUILD OS pode parecer um rascunho ou protótipo funcional não estilizado. Toda e qualquer tela deve manter exatamente o mesmo nível de acabamento, elegância e autoridade visual da página inicial e da área de comando executivo."*

Esta skill é a **fonte da verdade viva** do Design System RSBUILD, evoluída continuamente pela Liderança Técnica (João) para garantir consistência estética, usabilidade sem fricção e distinção de produto de alto valor agregado.

---

## 2. Paleta de Cores & Tokens Canônicos

### Identidade Institucional (RSBUILD Brand)
- `--rsbuild-terracotta`: `#B5583C` (Cor de ação primária, botões de comando, frisos ativos e destaques).
- `--rsbuild-terracotta-hover`: `#9E4930` (Hover e estados de clique ativo).
- `--rsbuild-terracotta-soft`: `rgba(181, 88, 60, 0.12)` no dark / `#FBF2EF` no sand (Fundos de badges, tabs ativas).
- `--rsbuild-charcoal`: `#2B2C2E` (Sidebar executiva, cabeçalhos institucionais e superfícies escuras profundas).
- `--rsbuild-warm-beige`: `#D9CCB5` (Linhas de divisórias finas e bordas orgânicas).

### Modos Visuais Oficiais (Sand vs. Obsidian Dark)

| Token CSS | Tema Sand (Claro / Padrão) | Tema Dark (Obsidian / Auditoria) | Uso Obrigatório |
| :--- | :--- | :--- | :--- |
| `--bg` | `#F8F6F2` | `#141517` | Fundo geral da página e shell |
| `--surface` | `#FFFFFF` | `#1E2024` | Painéis, cards, modais e containers |
| `--surface-raised`| `#FDFCFA` | `#26292E` | Caixas internas, subcards e áreas de métrica |
| `--ink` / `--foreground` | `#2B2C2E` / `#1F2937` | `#FFFFFF` | Textos principais, títulos e números |
| `--muted` / `--rsbuild-muted` | `#7E7873` | `#A8A298` | Subtítulos, labels secundárias e timestamps |
| `--line` / `--rsbuild-border` | `#E5E1D8` | `#2E3036` | Bordas e divisores estruturais |
| `--shadow` | `0 8px 30px rgba(43,44,46,0.04)` | `0 8px 32px rgba(0,0,0,0.5)` | Sombreamento de cards e menus flutuantes |

> [!CAUTION]
> **Proibição Estrita de Cores Fixas:** Nunca utilize `color: "#1F2937"` ou `background: "#FFFFFF"` hardcoded em estilos inline. Sempre utilize `var(--ink)`, `var(--surface)`, `var(--muted)` e `var(--line)`, pois caso contrário o elemento desaparecerá ou ficará ilegível quando o usuário alternar para o tema Dark.

---

## 3. Tipografia & Hierarquia Cognitiva

- **Fonte Principal (Interface & Números):** `'DM Sans', system-ui, sans-serif`
- **Fonte de Identidade & Eyebrows:** `'Libre Franklin', Arial, sans-serif`
- **Hierarquia de Títulos:**
  - `Eyebrow`: `font-size: 10px`, `font-weight: 800`, `letter-spacing: 1.2px`, `text-transform: uppercase`, cor terracota ou muted.
  - `H1 (Page/Cockpit Title)`: `font-size: 24px`, `font-weight: 700`, `letter-spacing: -0.02em`, cor `var(--ink)`.
  - `H2 (Section Heading)`: `font-size: 18px-20px`, `font-weight: 700`, cor `var(--ink)`.
  - `H3 (Card Title / Subseção)`: `font-size: 14px-15px`, `font-weight: 600`, cor `var(--ink)`.
  - `Body / Parágrafos`: `font-size: 13px-14px`, `line-height: 1.5`, cor `var(--muted)`.
  - `Metadados & Badges`: `font-size: 11px-12px`, `font-weight: 600`.

---

## 4. Catálogo de Componentes & Padrões Interativos

### A. Controles de Formulário e Sliders Elegantes
- **Inputs de Texto e Selects:**
  - Altura padrão de 38px a 42px, borda `1px solid var(--line)`, raio de 8px, background `var(--bg)` ou `var(--surface)`, foco com anel suave de terracota (`rgba(181, 88, 60, 0.25)`).
- **Sliders de Ajuste (`<input type="range">`):**
  - **Nunca usar o slider azul padrão do navegador.**
  - Usar a classe `.rsbuild-range-slider`: barra de trilha elegante em cinza sutil (`var(--line)`), preenchimento terracota, e botão de arraste circular estilizado com sombra sutil e indicação numérica em tempo real (ex: `50%`, `1.2x`).
- **Upload de Arquivos & Banners:**
  - **Nunca usar o `<input type="file">` cru com texto do sistema operacional.**
  - Utilizar a **Dropzone RSBUILD (`.banner-upload-dropzone`)**:
    - Área estilizada com borda tracejada (`1.5px dashed var(--line)`), ícone acolhedor, botão secundário estilizado "Selecionar Imagem" e suporte a drag-and-drop.
    - Pré-visualização instantânea (Live Preview) em canvas/moldura de aspect-ratio 16:9 ou 21:9 com manipulação visual de enquadramento (pan X/Y) e zoom em tempo real antes da persistência.

### B. Cards & Estruturas de Painel
- **Cockpit Card (`.card`, `.cockpit-card`):**
  - Fundo `var(--surface)`, borda `1px solid var(--line)`, bordas arredondadas de 10px ou 12px, micro-sombra suave.
  - Top accent opcional para indicar frente de projeto (ex: azul `#2563EB` para Indústria/MDS, violeta `#7C3AED` para Distribuição/Hub Açaí, terracota `#B5583C` para Governança).
- **Banner de Observabilidade (`.inline-note`):**
  - Barra superior de orientação com friso lateral esquerdo terracota de 3px, fundo sutil (`var(--surface)` no sand, `#18191C` no dark) e texto nítido.

### C. Sistema de Abas Executivas (`.admin-tabs` / `.module-tabs`)
- Quando um painel tiver mais de uma responsabilidade (ex: Administração contendo Convites e Identidade Visual), utilize abas horizontais refinadas:
  - Não sobrecarregue o usuário com formulários gigantescos na mesma tela.
  - Aba ativa com friso terracota, fundo translúcido e ícone contextual.

### D. Badges Semânticos e Status
- **Concluído / Recebido:** `background: rgba(16, 185, 129, 0.12)`, `color: #059669` (sand) / `#10B981` (dark).
- **Em Execução / Ativo:** `background: var(--rsbuild-terracotta-soft)`, `color: var(--rsbuild-terracotta)`.
- **Aguardando / Alerta:** `background: rgba(245, 158, 11, 0.12)`, `color: #D97706` (sand) / `#F59E0B` (dark).
- **Planejado:** `background: rgba(99, 102, 241, 0.08)`, `color: #4F46E5`.

---

## 5. Checklist de Auditoria de UI/UX (Antes de Todo Deploy)

Toda nova página ou componente alterado deve ser submetido ao checklist:
1. [ ] **Verificação de Tema Duplo:** O componente foi testado alternando para Sand e para Dark? O texto ficou visível e nítido em ambos?
2. [ ] **Zero Unstyled Chrome:** Há algum `<input type="file">`, `<input type="range">`, `<select>` ou scrollbar cru do navegador sem estilo aplicado?
3. [ ] **Feedback de Ação:** O botão exibe estado de loading (`busy`), desabilitado quando inválido e feedback de sucesso/erro claro em caso de resposta de API?
4. [ ] **Hierarquia Visual:** O título principal, subtítulo explicativo e tags de papel estão harmonizados com a identidade da marca?
5. [ ] **Responsividade:** O container se ajusta confortavelmente em telas de 1920px (Desktop), 1366px (Notebook) e menores sem quebras ou rolagem horizontal involuntária?

---

## 6. Procedimento de Aperfeiçoamento Contínuo
Sempre que um novo componente ou refinamento visual for criado:
1. Registre o novo padrão em `app/globals.css`.
2. Adicione a especificação e o caso de uso neste documento (`rsbuild-ui-ux`).
3. Mantenha os testes automatizados (`npm test`) e o typecheck (`tsc --noEmit`) 100% íntegros.
