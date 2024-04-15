const sharedKeys = {
  test: 'pk_test_51JpgUIFV3Il51eBDUO1s6JVOy9P3rFCkvX1Mbjvq4Qtkrj0ARg0CmXtYnpecsTyliVwvSJnEOOQXqUo0w48EKOP000oEdk14R2',
  live: 'pk_live_51JpgUIFV3Il51eBDWQworOndEE0S5T2HUqjowum8lPhSfpaboVz5iJlS1PfsWicfNtdUhTZhPSYtpJpZgI9Jc40800MkE0liSP'
}

window.addEventListener('DOMContentLoaded', e => {
  setTimeout(() => {
    const url = new URL(globalThis.location.href)
    const key = url.searchParams.get('dev') === 'true' ? sharedKeys.test : sharedKeys.live
    const stripe = Stripe(key)

    const elements = stripe.elements()

    const card = elements.create('card')

    card.mount('#card-element')

    const submitButton = document.getElementById('submit')

    submitButton.addEventListener('click', async event => {
      event.preventDefault()
      
      const result = await stripe.createPaymentMethod({
        type: 'card',
        card: card
      })

      if (result.error) {
        console.log(result.error.message)
        return
      }

      console.log('TOKEN!', result.paymentMethod.id)
    })
  }, 2048)
})
