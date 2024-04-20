import Tonic from 'npm:@socketsupply/tonic'

const T_YEARS = 1000 * 60 * 60 * 24 * 365
const T_MONTHS = 1000 * 60 * 60 * 24 * 30
const T_WEEKS = 1000 * 60 * 60 * 24 * 7
const T_DAYS = 1000 * 60 * 60 * 24
const T_HOURS = 1000 * 60 * 60
const T_MINUTES = 1000 * 60
const T_SECONDS = 1000

class RelativeDate extends Tonic {
  calculate () {
    const ts = this.props.ts
    const t = Math.abs(ts - new Date().getTime())
    const toString = i => String(parseInt(i, 10))

    if (t > T_YEARS) {
      return { value: `${toString(t / T_YEARS)}y` }
    } else if (t > T_MONTHS) {
      return { value: `${toString(t / T_MONTHS)}m` }
    } else if (t > T_WEEKS) {
      return { value: `${toString(t / T_WEEKS)}w` }
    } else if (t > T_DAYS) {
      return { value: `${toString(t / T_DAYS)}d` }
    } else if (t > T_HOURS) {
      return { value: `${toString(t / T_HOURS)}h` }
    } else if (t > T_MINUTES) {
      return { value: `${toString(t / T_MINUTES)}m`, timer: true }
    }
    return { value: `${toString(t / T_SECONDS)}s`, timer: true }
  }

  render () {
    let updates = 60
    const o = this.calculate()
    const timer = setInterval(() => {
      if (--updates === 0) return clearInterval(timer)
      const o = this.calculate()
      this.innerHTML = o.value
    }, 1000)

    return this.html`
      ${o.value}
    `
  }
}

export default RelativeDate
export { RelativeDate }
