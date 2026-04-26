import { Router } from 'express'

const router = Router()

router.get('/', (_req, res) => {
  res.json({ markers: [], note: 'blood work integration pending Factor results' })
})

export default router
