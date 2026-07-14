import { Rail } from '../../components/viz/Rail'
import { SECTION_ACCENTS, COLORS, FONT_MONO } from '../../theme'

const A = SECTION_ACCENTS.nutrition

export function NutritionLibrary() {
  return (
    <>
      <Rail label="FOOD LIBRARY" accent={A} right="0 FOODS · 0 RECIPES" />
      <p style={{ fontFamily: FONT_MONO, fontSize: 10, color: COLORS.textMuted, textAlign: 'center', padding: '24px 0' }}>
        NO SAVED FOODS YET
      </p>
    </>
  )
}
