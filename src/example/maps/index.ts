import type { ExMap } from '../types'
import { ASHENREACH } from './ashenreach'
import { CINDERFORD } from './cinderford'
import { CONTINENT } from './continent'
import { GLASS_BARROW } from './glass-barrow'
import { LIP_OF_THE_RENT } from './lip-of-rent'

/** The example world's maps, drawn when the world is loaded. Pins and places refer to pages by key. */
export const MAPS: ExMap[] = [CONTINENT, ASHENREACH, CINDERFORD, LIP_OF_THE_RENT, GLASS_BARROW]
