
### How to guide:
- We create the configmap on K8S to contain the kamailio configuration script:
`kubectl create configmap kamailio-config --from-file=kamailio.cfg -n fleet-control --dry-run=client -o yaml | kubectl apply -f -`
- 