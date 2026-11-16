# RSBUILD Icon System v1.0

Biblioteca vetorial interna para a interface do RSBUILD OS.

## Princípios
- Desenhos SVG originais em grid 24 × 24.
- Traçado monoline com junções e terminações arredondadas.
- Sem preenchimentos decorativos ou cores embutidas nos paths.
- Cor herdada de `currentColor`, controlada por tokens semânticos.
- Um único desenho atende aos temas `sand` (claro) e `dark`.

## Uso

```tsx
import { RsbuildIcon } from "@/app/components/rsbuild-icons";

<RsbuildIcon name="control-tower" size={22} tone="primary" />
<RsbuildIcon name="guardian" size={20} tone="accent" />
```

## Ícones disponíveis
- `control-tower`
- `finance`
- `reconciliation`
- `logistics`
- `guardian`
- `audit`
- `approval`
- `document`
- `import`
- `matching`
- `alert`
- `analytics`
- `users`
- `integration`
- `delivery`
- `search`

## Tons semânticos
- `primary`: identidade principal; bege no tema escuro e marrom RSBUILD no tema claro.
- `secondary`: informação secundária.
- `accent`: destaque terracota.
- `muted`: estado discreto ou desabilitado, sem comprometer a leitura em superfícies claras ou escuras.

Os tokens ficam em `app/globals.css` nas variáveis `--rs-icon-*`, com valores específicos para `data-theme="sand"` e `data-theme="dark"`.

## Regras de uso
- Não adicionar cores hexadecimais diretamente aos SVGs.
- Não usar emojis como substitutos de ícones de interface.
- Preferir 18–20 px em controles compactos e 22–24 px em cards.
- Usar o tom de destaque apenas para estado ativo, ação prioritária ou ênfase contextual.
- Manter área clicável e rótulo acessível no elemento interativo que contém o ícone.

## Escopo desta versão
Integrada ao guia inicial do produto e ao seletor de módulos da sidebar. A expansão para toda a navegação e demais áreas deve ocorrer gradualmente, preservando consistência e hierarquia visual.
