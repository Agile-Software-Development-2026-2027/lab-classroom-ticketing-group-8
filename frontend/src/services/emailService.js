import emailjs from "@emailjs/browser";

// queste 2 saranno sempre uguali perche associate all'account che invia le email
const serviceId=import.meta.env.VITE_EMAILJS_SERVICE_ID
const publicKey=import.meta.env.VITE_EMAILJS_PUBLIC_KEY

//otteniamo la chiave del template perche cambia in base all'azione per la quale vogliamo notificare

//template params avra la forma
/*
professor_name: "",
classroom_name: "",
booking_date: "",
start_time: "",
end_time: "",
to_email: "",
*/

export function sendEmailService(templateId, professor_name, classroom_name, booking_date, start_time, end_time, to_email){
    return emailjs.send(
        serviceId,//email di invio
        templateId,//template
        {
            professor_name: professor_name,
            classroom_name: classroom_name,
            booking_date: booking_date,
            start_time: start_time,
            end_time: end_time,
            to_email: to_email,
        },//dati che formano l'email
        {
            publicKey: publicKey,
        }
    )
}
