import { describe, expect, it } from 'vitest'
import { PHOTO_MAX_BYTES, checkNewFiles } from './vehiclePhotos'

function file(name: string, type = 'image/jpeg', size = 10) {
  const result = new File(['x'], name, { type })
  Object.defineProperty(result, 'size', { value: size })
  return result
}

describe('checkNewFiles', () => {
  it('accepts JPG, PNG and WebP files up to 5 MB', () => {
    const files = [file('a.jpg'), file('b.png', 'image/png'), file('c.webp', 'image/webp', PHOTO_MAX_BYTES)]

    expect(checkNewFiles(files, 0, 20)).toEqual({ accepted: files, rejections: [] })
  })

  it('rejects another type naming the file and keeps the rest', () => {
    const good = file('a.jpg')
    const result = checkNewFiles([file('anim.gif', 'image/gif'), good, file('doc.pdf', 'application/pdf')], 0, 20)

    expect(result.accepted).toEqual([good])
    expect(result.rejections).toEqual([
      'anim.gif: tiene que ser una imagen JPG, PNG o WebP.',
      'doc.pdf: tiene que ser una imagen JPG, PNG o WebP.',
    ])
  })

  it('rejects a file over 5 MB naming it', () => {
    const result = checkNewFiles([file('big.jpg', 'image/jpeg', PHOTO_MAX_BYTES + 1)], 0, 20)

    expect(result.accepted).toEqual([])
    expect(result.rejections).toEqual(['big.jpg: pesa más de 5 MB.'])
  })

  it('stops at the maximum, counting the photos already there, with a single message', () => {
    const files = [file('1.jpg'), file('2.jpg'), file('3.jpg'), file('4.jpg')]

    const result = checkNewFiles(files, 18, 20)

    expect(result.accepted).toEqual([files[0], files[1]])
    expect(result.rejections).toEqual(['Podés cargar hasta 20 fotos.'])
  })

  it('does not spend the limit on rejected files', () => {
    const good = file('ok.jpg')

    const result = checkNewFiles([file('x.gif', 'image/gif'), good], 19, 20)

    expect(result.accepted).toEqual([good])
    expect(result.rejections).toEqual(['x.gif: tiene que ser una imagen JPG, PNG o WebP.'])
  })
})
