const deleteProduct = (btn) =>{
   const productId = btn.parentNode.querySelector('[name=productId]').value;
   const csrf = btn.parentNode.querySelector('[name=_csrf]').value;

   //gives closest ancestor element
   const productElement = btn.closest('article')

   fetch(`/admin/product/${productId}`,{
        method:'DELETE',
        headers: {
            'csrf-token':csrf
        }
   }).then((res)=>{
        return res.json()
   }).then(data=>{
        console.log(data)
        productElement.parentNode.removeChild(productElement);
   }).catch(err=>{
        console.log(err)
   })
}