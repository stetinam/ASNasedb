ns=krenek-ns
kubectl -n $ns delete deployment.apps/nginx 
kubectl -n $ns delete deployment.apps/aspdb-api 
kubectl -n $ns delete ingress.networking.k8s.io/nginx 
#kubectl -n $ns delete persistentvolumeclaim/asparaginase-seq-database
#kubectl -n $ns delete persistentvolumeclaim/html-content
kubectl -n $ns delete service/nginx
kubectl -n $ns delete service/aspdb-api

